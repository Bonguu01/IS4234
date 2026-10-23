import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { loadScenario } from '../data/scenarios';
import { FEEDS, feedIds, importCsv, validateDataset } from './imports';
import { reconcile } from './reconcile';
import { advanceClock, applyRun, evaluateEscalations, initialState, updateCase, SLA_MS } from './workflow';
import { loadState, STORAGE_KEY } from '../state/storage';

const now = '2026-10-22T08:00:00.000Z';
function edit(dataset, id, mutate) {
  const source = dataset.feeds[id];
  const parsed = Papa.parse(source.text, { header: true });
  mutate(parsed.data);
  dataset.feeds[id] = importCsv(id, Papa.unparse({ fields: parsed.meta.fields, data: parsed.data }), source);
  return dataset;
}
function run(scenario = 'difference') { return reconcile(loadScenario(scenario, now), { systemNow: now }); }

describe('CSV error handling across all sources', () => {
  it.each(feedIds)('blocks an absent %s without interpreting it as zero', (id) => {
    const dataset = loadScenario('matching'); dataset.feeds[id] = null;
    const result = reconcile(dataset);
    expect(result.status).toBe('Blocked');
    expect(result.findings.some((item) => item.checkId === `feed:${id}` && item.severity === 'Critical')).toBe(true);
  });
  it.each(feedIds)('rejects duplicate records in %s', (id) => {
    const dataset = edit(loadScenario('matching'), id, (rows) => rows.push({ ...rows[0] }));
    expect(validateDataset(dataset)[id].status).toBe('Invalid');
    expect(reconcile(dataset).status).toBe('Blocked');
  });
  it.each(['bank_balances', 'customer_opening_balances', 'intermediary_balances'])('rejects header-only %s', (id) => {
    const dataset = edit(loadScenario('matching'), id, (rows) => rows.splice(0));
    expect(reconcile(dataset).status).toBe('Blocked');
  });
  it.each(['bank_id', 'partner_id', 'fbo_account_id', 'currency'])('rejects unsupported %s', (field) => {
    const dataset = edit(loadScenario('matching'), 'bank_transactions', (rows) => { rows[0][field] = 'UNSUPPORTED'; });
    expect(reconcile(dataset).status).toBe('Blocked');
  });
  it.each(['bank_transactions', 'intermediary_transactions', 'intermediary_balances'])('rejects unknown customers in %s', (id) => {
    const dataset = edit(loadScenario('matching'), id, (rows) => { rows[0].customer_id = 'UNKNOWN'; });
    expect(validateDataset(dataset)[id].status).toBe('Invalid');
  });
  it.each(['', '2026-02-30', '2026-13-01', 'not-a-date', '2026-10-21'])('blocks invalid/future declared coverage %s', (date) => {
    const dataset = loadScenario('matching'); dataset.feeds.bank_transactions.coverageDate = date;
    expect(reconcile(dataset).status).toBe('Blocked');
  });
  it('rejects future coverage even when every row matches its declared date', () => {
    const dataset = edit(loadScenario('matching'), 'bank_transactions', (rows) => rows.forEach((row) => { row.business_date = '2026-10-21'; }));
    dataset.feeds.bank_transactions.coverageDate = '2026-10-21';
    expect(validateDataset(dataset).bank_transactions.errors).toContain('Coverage is later than the selected business date.');
  });
  it('rejects duplicate headers, broken quotes and inconsistent row widths', () => {
    for (const transform of [
      (text) => text.replace('transaction_ref,customer_id', 'customer_id,customer_id'),
      (text) => text + '\r\n"unfinished',
      (text) => text + ',unexpected',
      (text) => text.slice(0, text.lastIndexOf(',')),
    ]) {
      const dataset = loadScenario('matching'); dataset.feeds.bank_transactions.text = transform(dataset.feeds.bank_transactions.text);
      expect(reconcile(dataset).status).toBe('Blocked');
    }
  });
  it('accepts BOM, CRLF, quoted cells, whitespace and extra informational columns', () => {
    const dataset = loadScenario('matching');
    feedIds.forEach((id) => {
      const source = dataset.feeds[id];
      const rows = Papa.parse(source.text, { header: true }).data;
      source.text = '\uFEFF' + Papa.unparse(rows.map((row) => ({ ...row, bank_id: ` ${row.bank_id} `, note: 'A quoted, descriptive value' })), { quotes: true }) + '\r\n\r\n';
    });
    expect(reconcile(dataset).status).toBe('Passed');
  });
  it.each(feedIds.filter((id) => FEEDS[id].money.some((field) => field !== 'amount')))('rejects negative balances in %s', (id) => {
    const field = FEEDS[id].money[0];
    const dataset = edit(loadScenario('matching'), id, (rows) => { rows[0][field] = '-0.01'; });
    expect(reconcile(dataset).status).toBe('Blocked');
  });
  it('blocks arithmetic overflow without crashing or issuing a pass', () => {
    const dataset = edit(loadScenario('matching'), 'intermediary_balances', (rows) => rows.forEach((row) => { row.closing_balance = '90071992547409.91'; }));
    const result = reconcile(dataset);
    expect(result.status).toBe('Blocked');
    expect(result.findings.some((item) => item.type === 'Calculation blocked')).toBe(true);
  });
});

describe('workflow rejection and deadline boundaries', () => {
  it.each([
    { type: 'assign', owner: 'Unknown user' },
    { type: 'note', text: '   ' },
    { type: 'status', status: 'Invalid' },
    { type: 'status', status: 'Investigating' },
    { type: 'status', status: 'Resolved', reason: 'Done' },
    { type: 'escalate', reason: '   ' },
    { type: 'unknown' },
  ])('rejects invalid action without mutating evidence: %j', (action) => {
    const state = applyRun(initialState(now), run()); const before = structuredClone(state);
    expect(() => updateCase(state, state.cases[0].id, action, now)).toThrow();
    expect(state).toEqual(before);
  });
  it('rejects actions for nonexistent cases', () => expect(() => updateCase(initialState(now), 'missing', { type: 'note', text: 'x' }, now)).toThrow('Case not found'));
  it.each([0, -1, Infinity, NaN, 8761])('rejects invalid clock advance %s', (hours) => expect(() => advanceClock(initialState(now), hours, now)).toThrow());
  it('escalates at exactly 24 hours, never one millisecond early', () => {
    const state = applyRun(initialState(now), run());
    const justBefore = new Date(Date.parse(now) + SLA_MS - 1).toISOString();
    expect(evaluateEscalations(state, justBefore).cases.every((item) => !item.escalatedAt)).toBe(true);
    const deadline = new Date(Date.parse(now) + SLA_MS).toISOString();
    const next = evaluateEscalations(state, deadline);
    expect(next.cases.every((item) => item.escalatedAt === deadline)).toBe(true);
    expect(evaluateEscalations(next, deadline).events).toEqual(next.events);
  });
  it('never escalates resolved cases and rejects duplicate manual escalation', () => {
    let state = applyRun(initialState(now), run()); const id = state.cases[0].id;
    state = updateCase(state, id, { type: 'escalate', reason: 'Review needed.' }, now);
    expect(() => updateCase(state, id, { type: 'escalate', reason: 'Again' }, now)).toThrow('already');
    state = applyRun(state, run('corrected'));
    state = updateCase(state, id, { type: 'assign', owner: 'Alex Carter' }, now);
    state = updateCase(state, id, { type: 'status', status: 'Resolved', reason: 'Verified correction.' }, now);
    expect(() => updateCase(state, id, { type: 'escalate', reason: 'Again' }, now)).toThrow('Resolved');
    const escalation = state.cases[0].escalatedAt;
    expect(advanceClock(state, 25, now).cases[0].escalatedAt).toBe(escalation);
  });
  it('leaves a resolved, previously un-escalated case out of overdue referrals', () => {
    let state = applyRun(initialState(now), run()); const id = state.cases[0].id;
    state = applyRun(state, run('corrected'));
    state = updateCase(state, id, { type: 'assign', owner: 'Alex Carter' }, now);
    state = updateCase(state, id, { type: 'status', status: 'Resolved', reason: 'Verified against corrected evidence.' }, now);
    const advanced = advanceClock(state, 25, now);
    expect(advanced.cases[0].escalatedAt).toBeNull();
    expect(advanced.events.some((event) => event.type === 'Escalated' && event.caseId === id)).toBe(false);
  });
  it('deduplicates reordered records while retaining new dates as separate investigations', () => {
    let state = applyRun(initialState(now), run());
    const reordered = loadScenario('difference', now);
    feedIds.forEach((id) => edit(reordered, id, (rows) => rows.reverse()));
    state = applyRun(state, reconcile(reordered, { systemNow: now }));
    expect(state.cases).toHaveLength(3);
    const nextDay = loadScenario('difference', now);
    nextDay.businessDate = '2026-10-21';
    feedIds.forEach((id) => {
      edit(nextDay, id, (rows) => rows.forEach((row) => { row.business_date = nextDay.businessDate; }));
      nextDay.feeds[id].coverageDate = nextDay.businessDate;
    });
    state = applyRun(state, reconcile(nextDay, { systemNow: now }));
    expect(state.cases).toHaveLength(6);
    expect(state.cases.filter((item) => item.businessDate === nextDay.businessDate)).toHaveLength(3);
  });
  it('rejects damaged monetary display values inside otherwise valid runs', () => {
    const state = applyRun(initialState(now), run());
    state.runs[0].checks.find((check) => check.id === 'aggregate').detail.differenceCents = 'not-money';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    expect(loadState().error).toMatch(/damaged/);
  });
});

describe('damaged saved workspaces', () => {
  it.each(['false', 'true', 1, null])('rejects a non-boolean correction flag (%j) instead of enabling resolution', (flag) => {
    const state = applyRun(initialState(now), run());
    state.cases[0].verifiedClear = flag;
    const raw = JSON.stringify(state); localStorage.setItem(STORAGE_KEY, raw);
    expect(loadState().error).toMatch(/damaged/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('handles unavailable browser storage without throwing', () => {
    expect(loadState({ getItem() { throw new Error('Access denied'); } }).error).toMatch(/Access denied/);
  });
  it.each([
    (state) => { state.runs = [{}]; },
    (state) => { state.cases = [{}]; },
    (state) => { state.events = [null]; },
    (state) => { state.dataset.feeds.bank_transactions = { text: null }; },
    (state) => { state.clock.baseBusinessAt = 'invalid'; },
    (state) => { state.version = 999; },
  ])('rejects nested damage without overwriting saved evidence (%#)', (damage) => {
    const state = initialState(now); damage(state);
    const raw = JSON.stringify(state); localStorage.setItem(STORAGE_KEY, raw);
    expect(loadState().error).toMatch(/not been overwritten/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
});
