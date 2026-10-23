import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { loadScenario } from '../data/scenarios';
import { importCsv, feedIds } from './imports';
import { reconcile } from './reconcile';
import { applyRun, initialState, updateCase } from './workflow';
import { startMonitoring, receiveDelivery, withdrawDelivery } from './monitoring';
import { assessRisk, evaluateRisk, recommendations, relatedCases, revokeStaleVerification, RISK_POLICY } from './risk';
import { loadState, saveState, STORAGE_KEY } from '../state/storage';

const now = '2026-10-22T08:00:00.000Z';
const later = '2026-10-22T08:01:00.000Z';
function runData(dataset, state = initialState(now), time = now) {
  return applyRun({ ...state, dataset }, reconcile(dataset, { systemNow: time }));
}
const scenario = (id = 'difference') => runData(loadScenario(id, now));
function gapDataset(cents) {
  const dataset = loadScenario('matching', now);
  for (const [feed, field, base] of [['intermediary_transactions', 'amount', 50000], ['intermediary_balances', 'closing_balance', 150000]]) {
    const source = dataset.feeds[feed]; const rows = Papa.parse(source.text, { header: true }).data;
    rows[0][field] = ((base + cents) / 100).toFixed(2);
    dataset.feeds[feed] = importCsv(feed, Papa.unparse(rows), source);
  }
  return dataset;
}
function onDate(dataset, date) {
  dataset.businessDate = date;
  feedIds.forEach((id) => {
    const source = dataset.feeds[id]; if (!source) return;
    const rows = Papa.parse(source.text, { header: true }).data.map((row) => ({ ...row, business_date: date }));
    dataset.feeds[id] = importCsv(id, Papa.unparse(rows), { ...source, coverageDate: date });
  });
  return dataset;
}

describe('current financial position without double counting', () => {
  it('reports the $400 position once, with one implicated customer despite three findings', () => {
    const risk = assessRisk(scenario());
    expect(risk).toMatchObject({ category: 'High', gapCents: 40000, customers: ['CUS-001'], allocationCount: 0, assessable: true });
    expect(risk.currentCases).toHaveLength(3);
  });
  it.each([-25001, -25000, -24999, -1, 0, 1, 24999, 25000, 25001])('uses the exact cent threshold for signed gap %i', (cents) => {
    const risk = assessRisk(runData(gapDataset(cents)));
    expect(risk.gapCents).toBe(cents);
    expect(risk.category).toBe(Math.abs(cents) >= RISK_POLICY.reviewGapCents ? 'High' : cents ? 'Review' : 'Clear');
  });
  it('keeps zero pooled gap separate from an allocation error and counts both customers once', () => {
    expect(assessRisk(scenario('allocation'))).toMatchObject({ gapCents: 0, category: 'High', allocationCount: 1, customers: ['CUS-001', 'CUS-002'] });
  });
  it('labels offsetting customer differences for review without inventing an allocation mismatch', () => {
    const dataset = loadScenario('matching', now); const source = dataset.feeds.intermediary_balances;
    const rows = Papa.parse(source.text, { header: true }).data;
    rows[0].closing_balance = '1501.00'; rows[1].closing_balance = '1899.00';
    dataset.feeds.intermediary_balances = importCsv('intermediary_balances', Papa.unparse(rows), source);
    expect(assessRisk(runData(dataset))).toMatchObject({ gapCents: 0, category: 'Review', allocationCount: 0, customers: ['CUS-001', 'CUS-002'] });
  });
  it.each(['missing', 'stale'])('does not display %s evidence as zero financial risk', (id) => {
    expect(assessRisk(scenario(id))).toMatchObject({ assessable: false, category: 'Unknown', gapCents: null, customers: null });
  });
  it('keeps Blocked reconstruction unknown even when the aggregate check passes', () => {
    const dataset = loadScenario('matching', now);
    dataset.feeds.bank_balances.text = dataset.feeds.bank_balances.text.replace('3000.00', '2900.00');
    const state = runData(dataset);
    expect(state.runs[0].checks.find((check) => check.id === 'aggregate').status).toBe('Passed');
    expect(assessRisk(state).gapCents).toBeNull();
  });
  it('handles no runs and fully staged but unprocessed inputs as unassessed', () => {
    expect(assessRisk(initialState(now)).category).toBe('Unknown');
    const state = { ...initialState(now), dataset: loadScenario('matching', now) };
    expect(assessRisk(state).gapCents).toBeNull();
    expect(recommendations(state)[0].title).toBe('Run a fresh reconciliation');
  });
  it('does not add repeat runs or consecutive daily positions', () => {
    let state = scenario(); state = runData(loadScenario('difference', now), state);
    state = runData(onDate(loadScenario('difference', now), '2026-10-21'), state);
    expect(assessRisk(state)).toMatchObject({ businessDate: '2026-10-21', gapCents: 40000 });
    expect(state.cases).toHaveLength(6);
  });
  it('replaying an older Passed day cannot hide a newer discrepant position', () => {
    let state = runData(onDate(loadScenario('difference', now), '2026-10-21'));
    state = runData(loadScenario('matching', later), state, later);
    expect(assessRisk(state)).toMatchObject({ businessDate: '2026-10-21', category: 'High', gapCents: 40000 });
  });
  it('a latest Blocked run does not fall back to a previous good snapshot', () => {
    const state = runData(loadScenario('missing', later), scenario('matching'), later);
    expect(assessRisk(state).category).toBe('Unknown');
  });
  it('corrected records clear the financial gap while administrative cases stay open', () => {
    const state = runData(loadScenario('corrected', later), scenario(), later);
    expect(assessRisk(state)).toMatchObject({ category: 'Clear', gapCents: 0, customers: [] });
    expect(state.cases.every((item) => item.status === 'Open' && item.verifiedClear)).toBe(true);
    expect(recommendations(state)[0].title).toBe('Document verified closure');
  });
  it('changed manual evidence requires recheck, but file metadata alone does not', () => {
    const state = scenario('matching');
    state.dataset.feeds.bank_balances.filename = 'renamed.csv'; state.dataset.feeds.bank_balances.importedAt = later;
    expect(assessRisk(state).category).toBe('Clear');
    state.dataset.feeds.bank_balances.coverageDate = '2026-10-19';
    expect(assessRisk(state).category).toBe('Unknown');
  });
  it('a newer staged manual date is unknown even if an older monitor previously passed', () => {
    let state = startMonitoring(initialState(now), loadScenario('matching', now), { systemAt: now });
    for (const id of ['intermediary_transactions', 'intermediary_balances']) {
      const source = loadScenario('matching', now).feeds[id];
      state = receiveDelivery(state, id, source.text, { coverageDate: source.coverageDate, systemAt: now });
    }
    state.dataset = onDate(loadScenario('matching', later), '2026-10-21');
    expect(assessRisk(state)).toMatchObject({ businessDate: '2026-10-21', category: 'Unknown', origin: 'manual' });
  });
  it('new/withdrawn monitoring evidence invalidates prior financial permission without changing manual inputs', () => {
    let state = scenario('matching'); const manual = structuredClone(state.dataset);
    state = startMonitoring(state, manual, { systemAt: later });
    expect(assessRisk(state).category).toBe('Unknown');
    for (const id of ['intermediary_transactions', 'intermediary_balances']) {
      const source = manual.feeds[id]; state = receiveDelivery(state, id, source.text, { coverageDate: source.coverageDate, systemAt: later });
    }
    expect(assessRisk(state).category).toBe('Clear');
    state = withdrawDelivery(state, 'intermediary_balances', later);
    expect(assessRisk(state).gapCents).toBeNull(); expect(state.dataset).toEqual(manual);
  });
});

describe('risk referrals, evidence relationships and persistence', () => {
  it('revokes financial closure when a monitored correction is withdrawn and restores it after a genuine recheck', () => {
    let state = startMonitoring(scenario(), loadScenario('matching', now), { systemAt: later });
    const sample = loadScenario('matching', later);
    for (const id of ['intermediary_transactions', 'intermediary_balances']) state = receiveDelivery(state, id, sample.feeds[id].text, { coverageDate: '2026-10-20', systemAt: later });
    expect(revokeStaleVerification(state, later).cases.every((item) => item.verifiedClear)).toBe(true);
    state = revokeStaleVerification(withdrawDelivery(state, 'intermediary_balances', later), later);
    expect(state.cases.filter((item) => item.kind !== 'delivery').every((item) => !item.verifiedClear)).toBe(true);
    state = receiveDelivery(state, 'intermediary_balances', sample.feeds.intermediary_balances.text, { coverageDate: '2026-10-20', systemAt: later });
    expect(revokeStaleVerification(state, later).cases.filter((item) => item.kind !== 'delivery').every((item) => item.verifiedClear)).toBe(true);
  });
  it('revokes closure permission when corrected manual evidence is replaced before another run', () => {
    let state = runData(loadScenario('corrected', later), scenario(), later);
    state.dataset = loadScenario('difference', later);
    state = revokeStaleVerification(state, later);
    expect(state.cases.every((item) => !item.verifiedClear)).toBe(true);
    expect(state.events.filter((event) => event.type === 'Recheck required')).toHaveLength(3);
    expect(revokeStaleVerification(state, later)).toEqual(state);
  });
  it('does not revoke a historical date or a valid monitored proof for unrelated manual staging', () => {
    let state = runData(loadScenario('corrected', later), scenario(), later);
    state.dataset = onDate(loadScenario('difference', later), '2026-10-21');
    expect(revokeStaleVerification(state, later).cases.every((item) => item.verifiedClear)).toBe(true);
    const proof = state.runs.at(-1); proof.origin = 'monitoring'; proof.monitoringId = 'prior-monitor';
    state.dataset = loadScenario('difference', later);
    expect(revokeStaleVerification(state, later).cases.every((item) => item.verifiedClear)).toBe(true);
  });
  it('refers current High cases once and retains supporting policy/run metadata', () => {
    const state = evaluateRisk(scenario(), later);
    expect(state.cases.every((item) => item.riskEscalation?.policyVersion === '1.0' && item.escalatedAt === later)).toBe(true);
    expect(state.events.filter((event) => event.riskPolicy)).toHaveLength(3);
    expect(evaluateRisk(state, later)).toEqual(state);
    const repeated = evaluateRisk(runData(loadScenario('difference', later), state, later), later);
    expect(repeated.events.filter((event) => event.riskPolicy)).toHaveLength(3);
    expect(saveState(repeated)).toBeNull(); expect(loadState().error).toBeNull();
    expect(evaluateRisk(loadState().state, later)).toEqual(repeated);
  });
  it('refers allocation cases without inventing a monetary shortfall', () => {
    const state = evaluateRisk(scenario('allocation'), later);
    expect(state.cases.some((item) => item.riskEscalation?.allocationCount === 1 && item.riskEscalation.gapCents === 0)).toBe(true);
  });
  it('does not refer small gaps, Unknown positions or cleared historical cases', () => {
    expect(evaluateRisk(runData(gapDataset(24999)), later).cases.every((item) => !item.riskEscalation)).toBe(true);
    const corrected = runData(loadScenario('corrected', later), scenario(), later);
    expect(evaluateRisk(corrected, later).cases.every((item) => !item.riskEscalation)).toBe(true);
    expect(evaluateRisk(scenario('missing'), later).cases.every((item) => !item.riskEscalation)).toBe(true);
  });
  it('preserves existing manual referrals and permits a fresh referral on verified recurrence', () => {
    let state = scenario(); const id = state.cases[0].id;
    state = updateCase(state, id, { type: 'escalate', reason: 'Existing analyst referral' }, now);
    state = evaluateRisk(state, later);
    expect(state.cases[0].escalationReason).toBe('Existing analyst referral');
    state = runData(loadScenario('corrected', later), state, later);
    state = updateCase(state, id, { type: 'assign', owner: 'Alex Carter' }, later);
    state = updateCase(state, id, { type: 'status', status: 'Resolved', reason: 'Verified correction' }, later);
    state = evaluateRisk(runData(loadScenario('difference', later), state, later), later);
    expect(state.cases[0].status).toBe('Open'); expect(state.cases[0].riskEscalation).toBeDefined();
  });
  it('links cases with explicit shared evidence/context without joining dates or matching amounts alone', () => {
    let state = scenario();
    const txCase = state.cases.find((item) => item.checkId === 'transactions');
    const links = relatedCases(state, txCase);
    expect(links.some((link) => link.reason === 'Shared transaction TX-001')).toBe(true);
    expect(links.some((link) => link.reason === 'Same reconciliation snapshot')).toBe(true);
    state = runData(onDate(loadScenario('difference', now), '2026-10-21'), state);
    expect(relatedCases(state, txCase).every((link) => link.item.businessDate === '2026-10-20')).toBe(true);
  });
  it('loads Phase 2 state unchanged and rejects damaged optional risk metadata without overwriting it', () => {
    const legacy = scenario(); expect(saveState(legacy)).toBeNull();
    expect(loadState().state).toEqual(legacy);
    const state = evaluateRisk(legacy, later); state.cases[0].riskEscalation.gapCents = 'bad';
    const raw = JSON.stringify(state); localStorage.setItem(STORAGE_KEY, raw);
    expect(loadState().error).toMatch(/damaged/); expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
});
