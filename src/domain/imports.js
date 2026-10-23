import Papa from 'papaparse';
import { parseCents } from './money.js';

export const SCOPE = Object.freeze({ bank_id: 'BANK-001', partner_id: 'PARTNER-001', fbo_account_id: 'FBO-001', currency: 'USD' });
const scopeFields = Object.keys(SCOPE);
export const FEEDS = {
  bank_balances: { label: 'Bank balances', file: 'bank_balances.csv', fields: ['business_date', 'opening_balance', 'closing_balance'], money: ['opening_balance', 'closing_balance'], keys: [] },
  customer_opening_balances: { label: 'Customer opening baseline', file: 'customer_opening_balances.csv', fields: ['business_date', 'customer_id', 'opening_balance'], money: ['opening_balance'], keys: ['customer_id'] },
  bank_transactions: { label: 'Bank transactions', file: 'bank_transactions.csv', fields: ['business_date', 'transaction_ref', 'customer_id', 'amount'], money: ['amount'], keys: ['transaction_ref'], allowEmpty: true },
  intermediary_transactions: { label: 'Intermediary transactions', file: 'intermediary_transactions.csv', fields: ['business_date', 'transaction_ref', 'customer_id', 'amount'], money: ['amount'], keys: ['transaction_ref'], allowEmpty: true },
  intermediary_balances: { label: 'Intermediary balances', file: 'intermediary_balances.csv', fields: ['business_date', 'customer_id', 'closing_balance'], money: ['closing_balance'], keys: ['customer_id'] },
};
export const feedIds = Object.keys(FEEDS);
export const DATE_FORMATS = [
  { value: 'iso', label: 'YYYY-MM-DD (standard)' },
  { value: 'us', label: 'MM/DD/YYYY (month first)' },
];

export function normalizeCsvDate(value, format = 'iso') {
  if (format === 'iso') return isDate(value) ? value : null;
  if (format !== 'us') return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value ?? '');
  if (!match) return null;
  const normalized = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return isDate(normalized) ? normalized : null;
}

export function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

// FNV-1a identifies demonstration inputs; it is not an authenticity/security claim.
export function fingerprint(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function importCsv(feedId, text, { filename = FEEDS[feedId].file, coverageDate = '', importedAt = new Date().toISOString(), dateFormat = 'iso' } = {}) {
  return { feedId, filename, text, coverageDate, importedAt, dateFormat, fingerprint: fingerprint(text) };
}

export function validateFeed(feedId, source, businessDate, scope = SCOPE) {
  const definition = FEEDS[feedId];
  const errors = [];
  if (!source) return { status: 'Missing', rows: [], errors: ['Required source is unavailable.'] };
  if (source.importError) return { status: 'Invalid', rows: [], errors: [`Delivery rejected: ${source.importError}`] };
  if (!isDate(source.coverageDate)) errors.push('A valid declared coverage date is required.');
  if (!isDate(businessDate)) errors.push('Select a valid reconciliation business date.');
  const dateFormat = source.dateFormat ?? 'iso';
  if (!DATE_FORMATS.some((format) => format.value === dateFormat)) errors.push('Unsupported CSV date format.');
  const parsed = Papa.parse(source.text, { header: true, skipEmptyLines: 'greedy', transformHeader: (value) => value.replace(/^\uFEFF/, '').trim() });
  parsed.errors.forEach((error) => errors.push(`CSV: ${error.message}`));
  const required = [...scopeFields, ...definition.fields];
  required.forEach((field) => { if (!parsed.meta.fields?.includes(field)) errors.push(`Missing column: ${field}.`); });
  if (parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length) errors.push('Duplicate column names are not allowed.');
  if (!definition.allowEmpty && parsed.data.length === 0) errors.push('This source must contain records.');
  if (feedId === 'bank_balances' && parsed.data.length !== 1) errors.push('Exactly one bank balance record is required.');
  const seen = new Set();
  const rows = parsed.data.map((raw, index) => {
    const row = { rowNumber: index + 2 };
    required.forEach((field) => {
      row[field] = String(raw[field] ?? '').trim();
      if (!row[field]) errors.push(`Row ${index + 2}: ${field} is required.`);
    });
    scopeFields.forEach((field) => { if (row[field] !== scope[field]) errors.push(`Row ${index + 2}: unsupported ${field}.`); });
    const normalizedDate = normalizeCsvDate(row.business_date, dateFormat);
    if (!normalizedDate) errors.push(`Row ${index + 2}: business_date must be a valid ${dateFormat === 'us' ? 'MM/DD/YYYY (month first)' : 'YYYY-MM-DD'} date. Check the CSV date format selection.`);
    else {
      row.business_date = normalizedDate;
      if (row.business_date !== source.coverageDate) errors.push(`Row ${index + 2}: business_date must match the declared coverage date.`);
    }
    definition.money.forEach((field) => {
      try {
        row[`${field}_cents`] = parseCents(row[field]);
        if (field !== 'amount' && row[`${field}_cents`] < 0) errors.push(`Row ${index + 2}: balances cannot be negative.`);
      } catch (error) { errors.push(`Row ${index + 2}: ${field}: ${error.message}`); }
    });
    const key = [...scopeFields, 'business_date', ...definition.keys].map((field) => row[field]).join('|');
    if (seen.has(key)) errors.push(`Row ${index + 2}: duplicate record key (${definition.keys.join(', ') || 'account'}).`);
    seen.add(key);
    return row;
  });
  if (errors.length) return { status: 'Invalid', rows, errors };
  if (source.coverageDate < businessDate) return { status: 'Stale', rows, errors: ['Coverage predates the selected business date.'] };
  if (source.coverageDate > businessDate) return { status: 'Invalid', rows, errors: ['Coverage is later than the selected business date.'] };
  return { status: 'Ready', rows, errors: [] };
}

export function validateDataset(dataset) {
  const feeds = Object.fromEntries(feedIds.map((id) => [id, validateFeed(id, dataset.feeds[id], dataset.businessDate, dataset.scope)]));
  const baseline = feeds.customer_opening_balances;
  if (baseline.status === 'Ready') {
    const customers = new Set(baseline.rows.map((row) => row.customer_id));
    ['bank_transactions', 'intermediary_transactions', 'intermediary_balances'].forEach((id) => {
      if (feeds[id].status !== 'Ready') return;
      const unknown = feeds[id].rows.filter((row) => !customers.has(row.customer_id));
      if (unknown.length) {
        feeds[id].status = 'Invalid';
        feeds[id].errors.push(...unknown.map((row) => `Row ${row.rowNumber}: customer ${row.customer_id} is absent from the opening baseline.`));
      }
    });
  }
  return feeds;
}
