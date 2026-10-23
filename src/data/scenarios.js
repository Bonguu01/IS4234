import Papa from 'papaparse';
import { FEEDS, SCOPE, feedIds, importCsv } from '../domain/imports.js';

export const SAMPLE_DATE = '2026-10-20';
export const SCENARIOS = [
  { id: 'matching', label: '01 · Matching records', description: 'All five sources agree. Every required check should pass.' },
  { id: 'difference', label: '02 · $400 discrepancy', description: 'A posted credit is overstated by $400 in the intermediary records.' },
  { id: 'corrected', label: '03 · Corrected records', description: 'Corrects the $400 scenario for the same business date. Recheck before resolving cases.' },
  { id: 'allocation', label: '04 · Customer allocation error', description: 'Pooled totals match, but a transaction belongs to the wrong customer.' },
  { id: 'missing', label: '05 · Missing intermediary feed', description: 'The intermediary closing ledger is unavailable. Dependent checks must be blocked.' },
  { id: 'stale', label: '06 · Stale intermediary feed', description: 'The intermediary closing ledger covers yesterday, not the selected business date.' },
];

export function scenarioCsv(id = 'matching') {
  if (!SCENARIOS.some((scenario) => scenario.id === id)) throw new Error('Unknown sample scenario.');
  const records = {
    bank_balances: [{ opening_balance: '3000.00', closing_balance: '3400.00' }],
    customer_opening_balances: [{ customer_id: 'CUS-001', opening_balance: '1000.00' }, { customer_id: 'CUS-002', opening_balance: '2000.00' }],
    bank_transactions: [{ transaction_ref: 'TX-001', customer_id: 'CUS-001', amount: '500.00' }, { transaction_ref: 'TX-002', customer_id: 'CUS-002', amount: '-100.00' }],
    intermediary_transactions: [{ transaction_ref: 'TX-001', customer_id: 'CUS-001', amount: id === 'difference' ? '900.00' : '500.00' }, { transaction_ref: 'TX-002', customer_id: 'CUS-002', amount: '-100.00' }],
    intermediary_balances: [{ customer_id: 'CUS-001', closing_balance: id === 'difference' ? '1900.00' : '1500.00' }, { customer_id: 'CUS-002', closing_balance: '1900.00' }],
  };
  if (id === 'allocation') {
    records.intermediary_transactions[0].customer_id = 'CUS-002';
    records.intermediary_balances = [{ customer_id: 'CUS-001', closing_balance: '1000.00' }, { customer_id: 'CUS-002', closing_balance: '2400.00' }];
  }
  return Object.fromEntries(feedIds.map((feed) => {
    if (id === 'missing' && feed === 'intermediary_balances') return [feed, null];
    const date = id === 'stale' && feed === 'intermediary_balances' ? '2026-10-19' : SAMPLE_DATE;
    const fields = [...Object.keys(SCOPE), ...FEEDS[feed].fields];
    const data = records[feed].map((row) => ({ ...SCOPE, business_date: date, ...row }));
    return [feed, { text: Papa.unparse({ fields, data }), coverageDate: date }];
  }));
}

export function loadScenario(id, systemNow = new Date().toISOString()) {
  const files = scenarioCsv(id);
  return { name: SCENARIOS.find((scenario) => scenario.id === id).label, scope: { ...SCOPE }, businessDate: SAMPLE_DATE,
    feeds: Object.fromEntries(feedIds.map((feed) => [feed, files[feed] ? importCsv(feed, files[feed].text, { filename: FEEDS[feed].file, coverageDate: files[feed].coverageDate, importedAt: systemNow }) : null])) };
}
