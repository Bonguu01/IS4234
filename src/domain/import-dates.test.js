import { describe, expect, it } from 'vitest';
import { importCsv, normalizeCsvDate, validateDataset } from './imports';
import { loadScenario } from '../data/scenarios';
import { reconcile } from './reconcile';
import { applyRun, initialState } from './workflow';
import { assessRisk, revokeStaleVerification } from './risk';
import { loadState, saveState } from '../state/storage';
import { receiveDelivery, startMonitoring } from './monitoring';

function excelSource(dataset, feed = 'intermediary_balances', dateFormat = 'us') {
  const source = dataset.feeds[feed];
  dataset.feeds[feed] = importCsv(feed, source.text.replaceAll('2026-10-20', '10/20/2026'), { ...source, dateFormat });
  return dataset;
}

describe('explicit CSV date formats', () => {
  it.each([
    ['2026-10-20', 'iso', '2026-10-20'], ['10/20/2026', 'us', '2026-10-20'],
    ['1/2/2026', 'us', '2026-01-02'], ['01/02/2026', 'us', '2026-01-02'],
    ['02/29/2024', 'us', '2024-02-29'],
    ['02/29/2026', 'us', null], ['02/30/2026', 'us', null],
    ['13/01/2026', 'us', null], ['00/20/2026', 'us', null],
    ['10/20/26', 'us', null], ['2026-10-20', 'us', null],
    ['10/20/2026', 'iso', null], ['20/10/2026', 'us', null],
    ['2026-10-20', 'unknown', null],
  ])('parses %s only under %s as %s', (input, format, expected) => {
    expect(normalizeCsvDate(input, format)).toBe(expected);
  });

  it('normalises all five feeds without changing raw CSV or exact monetary checks', () => {
    const dataset = loadScenario('matching');
    Object.keys(dataset.feeds).forEach((feed) => excelSource(dataset, feed));
    expect(reconcile(dataset).status).toBe('Passed');
    expect(validateDataset(dataset).intermediary_balances.rows[0].business_date).toBe('2026-10-20');
    expect(dataset.feeds.intermediary_balances.text).toContain('10/20/2026');
    dataset.feeds.intermediary_balances.text = dataset.feeds.intermediary_balances.text.replace('1500.00', '1501.23');
    const run = reconcile(dataset);
    expect(run.status).toBe('Exceptions');
    expect(run.checks.find((check) => check.id === 'aggregate').detail.differenceCents).toBe(123);
  });

  it('rejects mismatched coverage, mixed formats and impossible dates', () => {
    for (const date of ['10/21/2026', '2026-10-20', '02/30/2026']) {
      const dataset = excelSource(loadScenario('matching'));
      dataset.feeds.intermediary_balances.text = dataset.feeds.intermediary_balances.text.replace('10/20/2026', date);
      expect(reconcile(dataset).status).toBe('Blocked');
    }
    expect(reconcile(excelSource(loadScenario('matching'), 'intermediary_balances', 'iso')).status).toBe('Blocked');
  });

  it('preserves format on reload and treats legacy sources as ISO', () => {
    const state = initialState(); state.dataset = excelSource(loadScenario('matching'));
    expect(saveState(state)).toBeNull();
    const loaded = loadState(); expect(loaded.error).toBeNull();
    expect(reconcile(loaded.state.dataset).status).toBe('Passed');
    state.dataset = loadScenario('matching');
    Object.values(state.dataset.feeds).forEach((source) => { delete source.dateFormat; });
    expect(saveState(state)).toBeNull(); expect(loadState().error).toBeNull();
    expect(reconcile(loadState().state.dataset).status).toBe('Passed');
  });

  it('requires recheck after changing interpretation of verified evidence', () => {
    let state = initialState(); state.dataset = loadScenario('difference');
    state = applyRun(state, reconcile(state.dataset));
    state.dataset = loadScenario('corrected'); state = applyRun(state, reconcile(state.dataset));
    expect(state.cases.every((item) => item.verifiedClear)).toBe(true);
    state.dataset.feeds.intermediary_balances.dateFormat = 'us';
    expect(assessRisk(state).category).toBe('Unknown');
    expect(revokeStaleVerification(state).cases.every((item) => !item.verifiedClear)).toBe(true);
  });

  it('uses the same strict normalisation for monitoring deliveries', () => {
    const dataset = excelSource(excelSource(loadScenario('matching'), 'intermediary_transactions'));
    let state = startMonitoring(initialState(), dataset);
    for (const feed of ['intermediary_transactions', 'intermediary_balances']) {
      const source = dataset.feeds[feed];
      state = receiveDelivery(state, feed, source.text, source);
    }
    expect(state.runs.at(-1).status).toBe('Passed');
  });
});
