import { validateDataset } from './imports';
import { difference, sumCents } from './money';

export const RULE_VERSION = '1.0';
const sum = (rows, field) => sumCents(rows.map((row) => row[field]));
const evidence = (feed, row) => ({ feed, rowNumber: row?.rowNumber ?? null, record: row ?? null });

export function reconcile(dataset, { systemNow = new Date().toISOString(), id = crypto.randomUUID() } = {}) {
  const validation = validateDataset(dataset);
  const checks = [];
  const findings = [];
  const add = (checkId, entity, type, message, amountCents = null, records = [], severity = 'High') => {
    const key = JSON.stringify([RULE_VERSION, dataset.scope, dataset.businessDate, checkId, entity, type]);
    findings.push({ key, checkId, entity, type, message, amountCents, evidence: records, severity });
  };
  Object.entries(validation).forEach(([feed, result]) => {
    const checkId = `feed:${feed}`;
    checks.push({ id: checkId, label: `${feed.replaceAll('_', ' ')} availability`, status: result.status === 'Ready' ? 'Passed' : 'Blocked' });
    if (result.status !== 'Ready') add(checkId, feed, 'Source unavailable or invalid', `${result.status}: ${result.errors.join(' ')}`, null, [], 'Critical');
  });
  const rows = (feed) => validation[feed].rows;
  const execute = (checkId, label, dependencies, task, extraReady = true) => {
    if (!extraReady || dependencies.some((feed) => validation[feed].status !== 'Ready')) {
      checks.push({ id: checkId, label, status: 'Blocked', detail: 'Required inputs or opening baseline are not usable.' });
      return;
    }
    const start = findings.length;
    try {
      const detail = task();
      checks.push({ id: checkId, label, status: findings.length > start ? 'Exceptions' : 'Passed', detail });
    } catch (error) {
      add(checkId, 'calculation', 'Calculation blocked', error.message, null, [], 'Critical');
      checks.push({ id: checkId, label, status: 'Blocked', detail: error.message });
    }
  };
  execute('opening', 'Opening baseline control', ['bank_balances', 'customer_opening_balances'], () => {
    const bank = rows('bank_balances')[0];
    const total = sum(rows('customer_opening_balances'), 'opening_balance_cents');
    const delta = difference(total, bank.opening_balance_cents);
    if (delta) add('opening', 'FBO', 'Opening baseline mismatch', 'Customer opening balances differ from the bank opening balance.', delta,
      [evidence('bank_balances', bank), ...rows('customer_opening_balances').map((row) => evidence('customer_opening_balances', row))]);
    return { expectedCents: bank.opening_balance_cents, actualCents: total, differenceCents: delta };
  });
  execute('bank_movement', 'Bank movement consistency', ['bank_balances', 'bank_transactions'], () => {
    const bank = rows('bank_balances')[0];
    const calculated = sumCents([bank.opening_balance_cents, sum(rows('bank_transactions'), 'amount_cents')]);
    const delta = difference(calculated, bank.closing_balance_cents);
    if (delta) add('bank_movement', 'FBO', 'Bank movement mismatch', 'Bank opening balance plus posted movements does not equal its closing balance.', delta,
      [evidence('bank_balances', bank), ...rows('bank_transactions').map((row) => evidence('bank_transactions', row))]);
    return { expectedCents: bank.closing_balance_cents, actualCents: calculated, differenceCents: delta };
  });
  execute('aggregate', 'Aggregate balance reconciliation', ['bank_balances', 'intermediary_balances'], () => {
    const bank = rows('bank_balances')[0];
    const total = sum(rows('intermediary_balances'), 'closing_balance_cents');
    const delta = difference(total, bank.closing_balance_cents);
    if (delta) add('aggregate', 'FBO', 'Aggregate balance mismatch', 'Intermediary customer closing balances differ from the bank closing balance.', delta,
      [evidence('bank_balances', bank), ...rows('intermediary_balances').map((row) => evidence('intermediary_balances', row))]);
    return { expectedCents: bank.closing_balance_cents, actualCents: total, differenceCents: delta };
  });
  execute('transactions', 'Transaction-level reconciliation', ['bank_transactions', 'intermediary_transactions'], () => {
    const bank = new Map(rows('bank_transactions').map((row) => [row.transaction_ref, row]));
    const intermediary = new Map(rows('intermediary_transactions').map((row) => [row.transaction_ref, row]));
    for (const ref of new Set([...bank.keys(), ...intermediary.keys()])) {
      const a = bank.get(ref); const b = intermediary.get(ref);
      const records = [a && evidence('bank_transactions', a), b && evidence('intermediary_transactions', b)].filter(Boolean);
      if (!a || !b) add('transactions', ref, 'Missing transaction', `${ref} is missing from ${!a ? 'bank' : 'intermediary'} transactions.`, null, records);
      else {
        const delta = difference(b.amount_cents, a.amount_cents);
        if (delta) add('transactions', ref, 'Transaction amount mismatch', `${ref} has different amounts across sources.`, delta, records);
        if (a.customer_id !== b.customer_id) add('transactions', ref, 'Customer allocation mismatch', `${ref} is allocated to different customers.`, null, records);
      }
    }
    return { bankRecords: bank.size, intermediaryRecords: intermediary.size };
  });
  const openingReady = checks.find((check) => check.id === 'opening')?.status === 'Passed';
  const customerCheck = (checkId, label, transactions, extraReady) => execute(checkId, label,
    ['customer_opening_balances', transactions, 'intermediary_balances'], () => {
      const balances = new Map(rows('intermediary_balances').map((row) => [row.customer_id, row]));
      const movements = new Map();
      rows(transactions).forEach((row) => {
        if (!movements.has(row.customer_id)) movements.set(row.customer_id, []);
        movements.get(row.customer_id).push(row);
      });
      for (const opening of rows('customer_opening_balances')) {
        const customer = opening.customer_id; const closing = balances.get(customer);
        const tx = movements.get(customer) ?? [];
        const records = [evidence('customer_opening_balances', opening), ...tx.map((row) => evidence(transactions, row)), ...(closing ? [evidence('intermediary_balances', closing)] : [])];
        if (!closing) add(checkId, customer, 'Missing customer balance', `${customer} is missing from the intermediary closing ledger.`, null, records);
        else {
          const calculated = sumCents([opening.opening_balance_cents, sum(tx, 'amount_cents')]);
          const delta = difference(closing.closing_balance_cents, calculated);
          if (delta) add(checkId, customer, 'Customer balance mismatch', `${customer}: reported closing balance differs from opening balance plus ${transactions === 'bank_transactions' ? 'bank' : 'intermediary'} movements.`, delta, records);
        }
      }
      return { customersChecked: rows('customer_opening_balances').length };
    }, extraReady);
  customerCheck('customers', 'Customer-level reconciliation', 'bank_transactions', openingReady);
  customerCheck('ledger', 'Intermediary ledger consistency', 'intermediary_transactions', openingReady);
  const status = checks.some((check) => check.status === 'Blocked') ? 'Blocked' : findings.length ? 'Exceptions' : 'Passed';
  return { id, ruleVersion: RULE_VERSION, systemAt: systemNow, businessDate: dataset.businessDate, scope: { ...dataset.scope },
    dataset: structuredClone(dataset), validation, checks, findings, status };
}
