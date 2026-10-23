import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { loadScenario } from '../data/scenarios';
import { importCsv, validateDataset, SCOPE } from './imports';
import { formatMoney, parseCents, sumCents } from './money';
import { reconcile } from './reconcile';

export function alter(dataset, feed, mutate) {
  const source = dataset.feeds[feed];
  const parsed = Papa.parse(source.text, { header: true });
  mutate(parsed.data);
  dataset.feeds[feed] = importCsv(feed, Papa.unparse({ fields: parsed.meta.fields, data: parsed.data }), source);
  return dataset;
}

describe('exact monetary calculations', () => {
  it('parses cents without floating point arithmetic', () => {
    expect(sumCents([parseCents('0.10'), parseCents('0.20')])).toBe(30);
    expect(parseCents('-001.05')).toBe(-105);
    expect(parseCents('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each(['1.001', '1e3', 'NaN', '', '1,000.00', '90071992547409.92'])('rejects invalid amount %s', (value) => expect(() => parseCents(value)).toThrow());
  it('rejects aggregate overflow', () => expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow());
  it('displays cents exactly even at the safe integer limit', () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe('$90,071,992,547,409.91');
    expect(formatMoney(-105)).toBe('-$1.05');
  });
});

describe('reconciliation', () => {
  it('passes genuinely matching records', () => {
    const run = reconcile(loadScenario('matching'));
    expect(run.status).toBe('Passed'); expect(run.findings).toEqual([]);
    expect(run.checks).toHaveLength(11);
  });
  it('computes a $400 discrepancy from source amounts', () => {
    const dataset = loadScenario('difference');
    const run = reconcile(dataset);
    expect(run.status).toBe('Exceptions');
    expect(run.findings.find((finding) => finding.checkId === 'aggregate').amountCents).toBe(40000);
    alter(dataset, 'intermediary_balances', (rows) => { rows[0].closing_balance = '1950.01'; });
    expect(reconcile(dataset).findings.find((finding) => finding.checkId === 'aggregate').amountCents).toBe(45001);
  });
  it('detects customer allocation errors despite matching pooled balances', () => {
    const run = reconcile(loadScenario('allocation'));
    expect(run.checks.find((check) => check.id === 'aggregate').status).toBe('Passed');
    expect(run.findings.filter((finding) => finding.checkId === 'customers')).toHaveLength(2);
    expect(run.findings.some((finding) => finding.type === 'Customer allocation mismatch')).toBe(true);
  });
  it.each(['bank_transactions', 'intermediary_transactions'])('detects records missing from %s', (feed) => {
    const dataset = alter(loadScenario('matching'), feed, (rows) => rows.pop());
    expect(reconcile(dataset).findings.some((finding) => finding.type === 'Missing transaction')).toBe(true);
  });
  it('does not treat a missing customer as a zero balance', () => {
    const dataset = alter(loadScenario('matching'), 'intermediary_balances', (rows) => rows.pop());
    expect(reconcile(dataset).findings.some((finding) => finding.type === 'Missing customer balance')).toBe(true);
  });
  it.each(['missing', 'stale'])('blocks %s evidence', (scenario) => {
    const run = reconcile(loadScenario(scenario));
    expect(run.status).toBe('Blocked');
    expect(run.checks.find((check) => check.id === 'aggregate').status).toBe('Blocked');
    expect(run.findings.some((finding) => finding.severity === 'Critical')).toBe(true);
  });
  it.each(['1.234', 'invalid', ''])('blocks malformed financial values %s', (value) => {
    const dataset = alter(loadScenario('matching'), 'bank_transactions', (rows) => { rows[0].amount = value; });
    expect(reconcile(dataset).status).toBe('Blocked');
  });
  it('blocks duplicate references, missing columns and unknown customers', () => {
    const duplicate = alter(loadScenario('matching'), 'bank_transactions', (rows) => rows.push(rows[0]));
    expect(reconcile(duplicate).status).toBe('Blocked');
    const columns = loadScenario('matching'); columns.feeds.bank_transactions.text = 'amount\n1.00';
    expect(reconcile(columns).status).toBe('Blocked');
    const unknown = alter(loadScenario('matching'), 'bank_transactions', (rows) => { rows[0].customer_id = 'UNKNOWN'; });
    expect(reconcile(unknown).status).toBe('Blocked');
  });
  it('blocks inconsistent opening baselines from customer reconstruction', () => {
    const dataset = alter(loadScenario('matching'), 'customer_opening_balances', (rows) => { rows[0].opening_balance = '900.00'; });
    expect(reconcile(dataset).checks.find((check) => check.id === 'customers').status).toBe('Blocked');
  });
  it('accepts explicitly dated zero-activity transaction feeds', () => {
    const dataset = loadScenario('matching');
    ['bank_transactions', 'intermediary_transactions'].forEach((feed) => alter(dataset, feed, (rows) => rows.splice(0)));
    alter(dataset, 'bank_balances', (rows) => { rows[0].closing_balance = '3000.00'; });
    alter(dataset, 'intermediary_balances', (rows) => { rows[0].closing_balance = '1000.00'; rows[1].closing_balance = '2000.00'; });
    expect(reconcile(dataset).status).toBe('Passed');
  });
  it('validates dates and supported scope', () => {
    const dataset = loadScenario('matching'); dataset.businessDate = '2026-02-30';
    expect(reconcile(dataset).status).toBe('Blocked');
    const other = alter(loadScenario('matching'), 'bank_transactions', (rows) => { rows[0].bank_id = 'OTHER'; });
    expect(validateDataset(other).bank_transactions.status).toBe('Invalid');
    expect(other.scope).toEqual(SCOPE);
  });
});
