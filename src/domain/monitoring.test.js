import { describe, expect, it } from 'vitest';
import { loadScenario } from '../data/scenarios';
import { MONITORING_SCENARIOS, nextReplayEvent, startReplay } from '../data/monitoring-scenarios';
import { DELIVERY_FEEDS, DELIVERY_WINDOW_MS, deliveryStatuses, evaluateMonitoring, receiveDelivery, setMonitoringActive, startMonitoring, withdrawDelivery } from './monitoring';
import { advanceClock, applyRun, initialState, updateCase } from './workflow';
import { reconcile } from './reconcile';
import { loadState, saveState, STORAGE_KEY } from '../state/storage';

const now = '2026-10-22T09:00:00.000Z';
const at = (minutes) => new Date(Date.parse(now) + minutes * 60000).toISOString();
const begin = () => startMonitoring(initialState(now), loadScenario('matching', now), { systemAt: now });
function deliver(state, feed, options = {}) {
  const source = loadScenario(options.sample ?? 'matching', options.systemAt ?? now).feeds[feed];
  return receiveDelivery(state, feed, source?.text ?? '', { filename: source?.filename, coverageDate: source?.coverageDate, systemAt: options.systemAt ?? now, ...options });
}

describe('daily delivery monitoring', () => {
  it('starts inactive and requires a valid date and usable bank records', () => {
    expect(initialState(now).monitoring).toEqual({ active: false, session: null });
    expect(() => startMonitoring(initialState(now), initialState(now).dataset, { systemAt: now })).toThrow(/bank/);
    const invalid = loadScenario('matching'); invalid.businessDate = '';
    expect(() => startMonitoring(initialState(now), invalid)).toThrow(/date/);
  });
  it('keeps monitored and manual snapshots separate and preserves historical dates', () => {
    const state = initialState(now); state.dataset = loadScenario('difference', now);
    const started = startReplay(state, 'on-time', now);
    expect(started.dataset).toEqual(state.dataset);
    expect(started.monitoring.session.snapshot.feeds.intermediary_transactions).toBeNull();
    const advanced = evaluateMonitoring(advanceClock(started, 1, now), now);
    expect(advanced.dataset).toEqual(state.dataset);
    expect(advanced.monitoring.session.snapshot.businessDate).toBe('2026-10-20');
    expect(advanced.events.every((item) => item.systemAt === now)).toBe(true);
  });
  it('waits before the deadline and generates exactly one case per source at the deadline', () => {
    const state = begin();
    expect(Date.parse(state.monitoring.session.dueBusinessAt) - Date.parse(now)).toBe(DELIVERY_WINDOW_MS);
    expect(evaluateMonitoring(state, at(4.999)).cases).toHaveLength(0);
    const overdue = evaluateMonitoring(state, at(5));
    expect(overdue.cases).toHaveLength(2);
    expect(overdue.cases.every((item) => item.kind === 'delivery' && item.escalatedAt === at(5))).toBe(true);
    expect(overdue.runs).toHaveLength(0);
    expect(evaluateMonitoring(overdue, at(6)).events).toEqual(overdue.events);
    expect(evaluateMonitoring(overdue, at(6)).cases).toHaveLength(2);
  });
  it('accepts a delivery processed at the exact deadline without a false case', () => {
    let state = deliver(begin(), 'intermediary_transactions', { systemAt: at(1) });
    state = deliver(state, 'intermediary_balances', { systemAt: at(5) });
    expect(state.cases).toHaveLength(0); expect(state.runs.at(-1).status).toBe('Passed');
  });
  it('does not reconcile partial evidence, and distinguishes valid delivery from financial agreement', () => {
    let state = deliver(begin(), 'intermediary_transactions', { sample: 'difference' });
    expect(state.runs).toHaveLength(0);
    state = deliver(state, 'intermediary_balances', { sample: 'difference' });
    expect(deliveryStatuses(state, now).every((item) => item.status === 'Received')).toBe(true);
    expect(state.runs.at(-1).status).toBe('Exceptions');
    expect(state.cases.every((item) => item.kind !== 'delivery')).toBe(true);
  });
  it.each(['stale', 'invalid'])('fails %s evidence immediately and does not fake recovery', (kind) => {
    let state = startReplay(initialState(now), kind, now);
    state = nextReplayEvent(state, now); state = nextReplayEvent(state, now);
    expect(state.cases).toHaveLength(1); expect(state.cases[0].verifiedClear).toBe(false);
    expect(state.cases[0].escalatedAt).toBe(now); expect(state.runs).toHaveLength(0);
    state = nextReplayEvent(state, now);
    expect(state.runs.at(-1).status).toBe('Passed'); expect(state.cases[0].verifiedClear).toBe(true);
    expect(state.cases[0].status).toBe('Open');
  });
  it('deduplicates delivery IDs and periodic evaluation without duplicate runs', () => {
    let state = deliver(begin(), 'intermediary_transactions', { deliveryId: 'once' });
    expect(deliver(state, 'intermediary_transactions', { deliveryId: 'once' })).toEqual(state);
    state = deliver(state, 'intermediary_balances');
    expect(state.runs).toHaveLength(1);
    expect(evaluateMonitoring(state, at(100)).runs).toHaveLength(1);
  });
  it('requires a new Passed snapshot to verify recovery; manual runs cannot bypass it', () => {
    let state = evaluateMonitoring(begin(), at(5)); const id = state.cases[0].id;
    state = applyRun(state, reconcile(loadScenario('matching'), { systemNow: at(6) }));
    expect(state.cases.find((item) => item.id === id).verifiedClear).toBe(false);
    state = deliver(state, 'intermediary_transactions', { sample: 'difference', systemAt: at(6) });
    state = deliver(state, 'intermediary_balances', { sample: 'difference', systemAt: at(6) });
    expect(state.runs.at(-1).status).toBe('Exceptions');
    expect(state.cases.find((item) => item.id === id).verifiedClear).toBe(false);
    for (const feed of DELIVERY_FEEDS) state = deliver(state, feed, { systemAt: at(7) });
    const item = state.cases.find((item) => item.id === id);
    expect(item.verifiedClear).toBe(true); expect(item.verificationRunId).toBe(state.runs.at(-1).id);
    state = updateCase(state, id, { type: 'assign', owner: 'Alex Carter' }, at(7));
    state = updateCase(state, id, { type: 'status', status: 'Resolved', reason: 'Delivery restored and reconciled.' }, at(7));
    expect(state.cases.find((item) => item.id === id).status).toBe('Resolved');
  });
  it('revokes prior verification and reopens a case when replacement evidence fails', () => {
    let state = evaluateMonitoring(begin(), at(5));
    for (const feed of DELIVERY_FEEDS) state = deliver(state, feed, { systemAt: at(6) });
    const id = state.cases[0].id;
    state = updateCase(state, id, { type: 'assign', owner: 'Alex Carter' }, at(6));
    state = updateCase(state, id, { type: 'status', status: 'Resolved', reason: 'Verified.' }, at(6));
    state = receiveDelivery(state, 'intermediary_transactions', 'bad CSV', { coverageDate: '2026-10-20', systemAt: at(7) });
    expect(state.cases.find((item) => item.id === id).status).toBe('Open');
    expect(state.cases.find((item) => item.id === id).verifiedClear).toBe(false);
    const previousRuns = state.runs.length;
    state = deliver(state, 'intermediary_transactions', { systemAt: at(8) });
    expect(state.runs).toHaveLength(previousRuns + 1);
    expect(state.cases.find((item) => item.id === id).verifiedClear).toBe(true);
  });
  it('does not clear delivery failures when financial reconstruction is Blocked', () => {
    const dataset = loadScenario('matching', now);
    dataset.feeds.bank_balances.text = dataset.feeds.bank_balances.text.replace('3000.00', '2900.00');
    let state = startMonitoring(initialState(now), dataset, { systemAt: now });
    state = evaluateMonitoring(state, at(5));
    for (const feed of DELIVERY_FEEDS) state = deliver(state, feed, { systemAt: at(6) });
    expect(state.runs.at(-1).status).toBe('Blocked');
    expect(state.cases.filter((item) => item.kind === 'delivery').every((item) => !item.verifiedClear)).toBe(true);
  });
  it('withdrawing a source removes verification until replacement and recheck', () => {
    let state = evaluateMonitoring(begin(), at(5));
    for (const feed of DELIVERY_FEEDS) state = deliver(state, feed, { systemAt: at(6) });
    state = withdrawDelivery(state, 'intermediary_transactions', at(7));
    expect(state.monitoring.session.snapshot.feeds.intermediary_transactions).toBeNull();
    expect(state.cases.every((item) => !item.verifiedClear)).toBe(true);
  });
  it('stop/resume retains history and detects overdue evidence on resume', () => {
    let state = setMonitoringActive(begin(), false, now);
    expect(evaluateMonitoring(state, at(10)).cases).toHaveLength(0);
    state = setMonitoringActive(state, true, at(10));
    expect(state.cases).toHaveLength(2);
    expect(() => receiveDelivery(setMonitoringActive(state, false), 'intermediary_balances', '', {})).toThrow(/resume/);
  });
  it('rejects invalid delivery inputs and missing monitoring windows', () => {
    expect(() => receiveDelivery(initialState(now), 'intermediary_balances', '')).toThrow(/Start/);
    expect(() => receiveDelivery(begin(), 'bank_balances', '')).toThrow(/two intermediary/);
    expect(() => receiveDelivery(begin(), 'intermediary_balances', 'x'.repeat(1024 * 1024))).toThrow(/1 MB/);
  });
});

describe('monitoring replay and persistence', () => {
  it('refreshes evidence for a new invalid receipt with the same error without duplicating its case', () => {
    let state = receiveDelivery(begin(), 'intermediary_balances', 'bad CSV', { filename: 'first.csv', coverageDate: '2026-10-20', deliveryId: 'first', systemAt: now });
    const id = state.cases[0].id;
    state = receiveDelivery(state, 'intermediary_balances', 'different bad CSV', { filename: 'second.csv', coverageDate: '2026-10-20', deliveryId: 'second', systemAt: at(1) });
    expect(state.cases).toHaveLength(1);
    expect(state.cases[0].id).toBe(id);
    expect(state.cases[0].evidence[0].record).toMatchObject({ deliveryId: 'second', filename: 'second.csv', csv: 'different bad CSV', actualReceivedAt: at(1) });
    expect(evaluateMonitoring(state, at(2)).events).toEqual(state.events);
    expect(state.events.filter((event) => event.type === 'Detected')).toHaveLength(1);
  });
  it('recovers persisted overdue deadlines on reopening without duplicate cases', () => {
    expect(saveState(begin())).toBeNull();
    const reopened = evaluateMonitoring(loadState().state, at(10));
    expect(reopened.cases).toHaveLength(2);
    expect(saveState(reopened)).toBeNull();
    const again = evaluateMonitoring(loadState().state, at(11));
    expect(again.cases).toEqual(reopened.cases);
    expect(again.events).toEqual(reopened.events);
  });
  it('a new window keeps old unresolved cases but revokes their prior recovery permission', () => {
    let state = evaluateMonitoring(begin(), at(5));
    for (const feed of DELIVERY_FEEDS) state = deliver(state, feed, { systemAt: at(6) });
    expect(state.cases.every((item) => item.verifiedClear)).toBe(true);
    const ids = state.cases.map((item) => item.id);
    state = startMonitoring(state, loadScenario('matching', at(7)), { systemAt: at(7) });
    expect(state.cases.map((item) => item.id)).toEqual(ids);
    expect(state.cases.every((item) => !item.verifiedClear)).toBe(true);
    expect(evaluateMonitoring(state, at(12)).cases).toHaveLength(2);
  });
  it.each(MONITORING_SCENARIOS.map((scenario) => [scenario.id, scenario.steps.length]))('processes %s from payloads and persists the session', (id, count) => {
    let state = startReplay(initialState(now), id, now);
    for (let i = 0; i < count; i++) state = nextReplayEvent(state, now);
    expect(state.runs.at(-1)?.status, JSON.stringify(deliveryStatuses(state, now).map(({ status, validation }) => ({ status, errors: validation.errors })))).toBe(id === 'difference' ? 'Exceptions' : 'Passed');
    expect(state.monitoring.session.replayIndex).toBe(count);
    expect(saveState(state)).toBeNull(); expect(loadState().error).toBeNull(); expect(loadState().state).toEqual(state);
    expect(() => nextReplayEvent(state, now)).toThrow(/No replay/);
    if (id === 'quiet') expect(state.cases).toHaveLength(0);
  });
  it('does not move simulated time backwards when the analyst advances it first', () => {
    let state = startReplay(initialState(now), 'on-time', now);
    state = advanceClock(state, 1, now);
    const before = state.clock.baseBusinessAt;
    state = nextReplayEvent(state, now);
    expect(state.clock.baseBusinessAt).toBe(before);
  });
  it('migrates version-1 workspaces without deleting their investigations or clock', () => {
    let old = applyRun(initialState(now), reconcile(loadScenario('difference'), { systemNow: now }));
    old.version = 1; delete old.monitoring;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    const loaded = loadState();
    expect(loaded.error).toBeNull(); expect(loaded.state.version).toBe(2);
    expect(loaded.state.cases).toEqual(old.cases); expect(loaded.state.clock).toEqual(old.clock);
    expect(loaded.state.monitoring).toEqual({ active: false, session: null });
  });
  it('rejects corrupt monitoring state without overwriting the original', () => {
    const state = begin(); state.monitoring.session.receipts = { bad: {} };
    const raw = JSON.stringify(state); localStorage.setItem(STORAGE_KEY, raw);
    expect(loadState().error).toMatch(/damaged/); expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
});
