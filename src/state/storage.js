import { initialState } from '../domain/workflow';
import { feedIds, SCOPE } from '../domain/imports';

export const STORAGE_KEY = 'ledgerwatch.phase1.v1';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string';
const date = (value) => text(value) && Number.isFinite(Date.parse(value));
const arrayOf = (value, predicate) => Array.isArray(value) && value.every(predicate);
const scope = (value) => object(value) && Object.keys(SCOPE).every((key) => value[key] === SCOPE[key]);
const source = (value) => value === null || (object(value) && ['text', 'filename', 'coverageDate', 'fingerprint', 'feedId'].every((key) => text(value[key])) && date(value.importedAt) && (value.dateFormat === undefined || ['iso', 'us'].includes(value.dateFormat)));
const dataset = (value) => object(value) && text(value.name) && text(value.businessDate) && scope(value.scope) && object(value.feeds) && feedIds.every((id) => id in value.feeds && source(value.feeds[id]));
const finding = (value) => object(value) && ['key', 'checkId', 'entity', 'type', 'message'].every((key) => text(value[key])) && ['High', 'Critical'].includes(value.severity)
  && (value.amountCents === null || Number.isSafeInteger(value.amountCents))
  && arrayOf(value.evidence, (record) => object(record) && text(record.feed) && (record.rowNumber === null || Number.isInteger(record.rowNumber)) && (record.record === null || object(record.record)));
const detail = (value) => value === undefined || value === null || text(value) || (object(value)
  && ['expectedCents', 'actualCents', 'differenceCents'].every((key) => !(key in value) || Number.isSafeInteger(value[key])));
const run = (value) => object(value) && text(value.id) && date(value.systemAt) && text(value.businessDate) && scope(value.scope) && dataset(value.dataset)
  && ['Passed', 'Exceptions', 'Blocked'].includes(value.status) && arrayOf(value.findings, finding)
  && arrayOf(value.checks, (check) => object(check) && text(check.id) && text(check.label) && ['Passed', 'Exceptions', 'Blocked'].includes(check.status) && detail(check.detail))
  && object(value.validation) && feedIds.every((id) => {
    const result = value.validation[id];
    return object(result) && ['Ready', 'Missing', 'Invalid', 'Stale'].includes(result.status) && arrayOf(result.rows, object) && arrayOf(result.errors, text);
  });
const caseRecord = (value) => finding(value) && ['id', 'displayId', 'owner', 'businessDate'].every((key) => text(value[key])) && scope(value.scope)
  && typeof value.verifiedClear === 'boolean'
  && (value.riskEscalation === undefined || (object(value.riskEscalation) && text(value.riskEscalation.policyVersion) && text(value.riskEscalation.runId) && text(value.riskEscalation.reason)
    && date(value.riskEscalation.systemAt) && Number.isSafeInteger(value.riskEscalation.gapCents) && Number.isInteger(value.riskEscalation.allocationCount) && value.riskEscalation.allocationCount >= 0))
  && ['Open', 'Investigating', 'Resolved'].includes(value.status) && date(value.firstDetectedAt) && date(value.dueBusinessAt)
  && (value.escalatedAt === null || date(value.escalatedAt))
  && (value.resolution === undefined || (object(value.resolution) && text(value.resolution.note) && date(value.resolution.systemAt) && date(value.resolution.businessAt) && text(value.resolution.runId)))
  && arrayOf(value.notes, (note) => object(note) && text(note.text) && text(note.actor) && date(note.systemAt) && date(note.businessAt));
const activity = (value) => object(value) && ['id', 'type', 'message', 'actor'].every((key) => text(value[key])) && date(value.systemAt) && date(value.businessAt);
const monitoring = (value, runs) => {
  if (!object(value) || typeof value.active !== 'boolean') return false;
  if (value.session === null) return value.active === false;
  const session = value.session;
  const feeds = ['intermediary_transactions', 'intermediary_balances'];
  return object(session) && text(session.id) && (session.scenario === null || text(session.scenario)) && dataset(session.snapshot)
    && date(session.startedAt) && date(session.startedBusinessAt) && date(session.dueBusinessAt) && Date.parse(session.dueBusinessAt) >= Date.parse(session.startedBusinessAt)
    && Number.isInteger(session.replayIndex) && session.replayIndex >= 0
    && (session.lastSignature === null || text(session.lastSignature))
    && (session.lastRunId === null || runs.some((run) => run.id === session.lastRunId && run.origin === 'monitoring' && run.monitoringId === session.id))
    && arrayOf(session.processedDeliveryIds, text) && object(session.receipts)
    && Object.entries(session.receipts).every(([feed, receipt]) => feeds.includes(feed) && object(receipt) && text(receipt.deliveryId) && date(receipt.systemAt) && date(receipt.businessAt) && text(receipt.fingerprint));
};

export function loadState(storage) {
  try {
    storage ??= window.localStorage;
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: initialState(), error: null };
    const state = JSON.parse(raw);
    if (!object(state) || ![1, 2].includes(state.version) || !dataset(state.dataset) || !arrayOf(state.runs, run) || !arrayOf(state.cases, caseRecord) || !arrayOf(state.events, activity) || !date(state.clock?.baseBusinessAt) || !date(state.clock?.baseSystemAt)
      || (state.version === 2 && !monitoring(state.monitoring, state.runs))) {
      throw new Error('Saved data has an unsupported or damaged structure.');
    }
    return { state: state.version === 1 ? { ...state, version: 2, monitoring: { active: false, session: null } } : state, error: null };
  } catch (error) {
    return { state: initialState(), error: `Saved workspace could not be loaded: ${error.message}. Existing storage has not been overwritten.` };
  }
}
export function saveState(state, storage) {
  try { (storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify(state)); return null; }
  catch (error) { return `Changes are only in memory. Browser storage failed: ${error.message}`; }
}
