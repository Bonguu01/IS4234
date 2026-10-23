import { FEEDS, feedIds, fingerprint, importCsv, isDate, validateDataset } from './imports.js';
import { reconcile } from './reconcile.js';
import { applyRun, businessNow, evaluateEscalations, recordEvent, registerFinding } from './workflow.js';

export const DELIVERY_FEEDS = ['intermediary_transactions', 'intermediary_balances'];
export const DELIVERY_WINDOW_MS = 5 * 60 * 1000;
const sameScope = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const caseKey = (session, feed) => JSON.stringify(['delivery-v1', session.snapshot.scope, session.snapshot.businessDate, feed]);
const audit = (state, type, message, systemAt) => recordEvent(state, type, message, systemAt, businessNow(state, systemAt), null, 'System', { monitoringId: state.monitoring.session.id });

export function deliveryStatuses(state, systemAt = new Date().toISOString()) {
  const session = state.monitoring?.session;
  if (!session) return [];
  const validation = validateDataset(session.snapshot);
  const overdue = Date.parse(businessNow(state, systemAt)) >= Date.parse(session.dueBusinessAt);
  return DELIVERY_FEEDS.map((feed) => {
    const source = session.snapshot.feeds[feed]; const result = validation[feed];
    return { feed, source, validation: result, received: session.receipts[feed] ?? null,
      status: source ? (result.status === 'Ready' ? 'Received' : result.status) : overdue ? 'Overdue' : 'Awaiting delivery' };
  });
}

export function startMonitoring(state, bankDataset, { scenario = null, systemAt = new Date().toISOString(), id = crypto.randomUUID() } = {}) {
  if (!isDate(bankDataset.businessDate)) throw new Error('Select a valid business date before starting monitoring.');
  const validation = validateDataset(bankDataset);
  const bankFeeds = feedIds.filter((feed) => !DELIVERY_FEEDS.includes(feed));
  if (bankFeeds.some((feed) => validation[feed].status !== 'Ready')) throw new Error('Monitoring needs valid bank balances, customer opening balances and bank transactions for the expected date.');
  const next = structuredClone(state);
  const startedBusinessAt = businessNow(next, systemAt);
  next.monitoring = { active: true, session: { id, scenario, startedAt: systemAt, startedBusinessAt,
    dueBusinessAt: new Date(Date.parse(startedBusinessAt) + DELIVERY_WINDOW_MS).toISOString(),
    snapshot: { ...structuredClone(bankDataset), name: 'Daily delivery monitoring snapshot', feeds: { ...structuredClone(bankDataset.feeds), intermediary_transactions: null, intermediary_balances: null } },
    receipts: {}, processedDeliveryIds: [], replayIndex: 0, lastSignature: null, lastRunId: null } };
  next.cases.filter((item) => item.kind === 'delivery' && item.businessDate === bankDataset.businessDate && sameScope(item.scope, bankDataset.scope)).forEach((item) => { item.verifiedClear = false; });
  audit(next, 'Monitoring started', `Expecting two intermediary sources for ${bankDataset.businessDate} within five simulated minutes.`, systemAt);
  return next;
}

export function evaluateMonitoring(state, systemAt = new Date().toISOString()) {
  if (!state.monitoring?.active || !state.monitoring.session) return evaluateEscalations(state, systemAt);
  let next = structuredClone(state);
  const session = next.monitoring.session;
  const statuses = deliveryStatuses(next, systemAt);
  const effectiveAt = businessNow(next, systemAt);
  for (const status of statuses) {
    if (!['Overdue', 'Invalid', 'Stale'].includes(status.status)) continue;
    const source = status.source;
    const message = `${FEEDS[status.feed].label}: ${status.status.toLowerCase()} delivery for ${session.snapshot.businessDate}. ${status.validation.errors.join(' ')}`;
    const finding = { key: caseKey(session, status.feed), kind: 'delivery', feed: status.feed, checkId: `delivery:${status.feed}`, entity: status.feed,
      type: 'Daily delivery failure', severity: 'Critical', amountCents: null, message,
      evidence: [{ feed: status.feed, rowNumber: null, record: { expectedBusinessDate: session.snapshot.businessDate, dueBusinessAt: session.dueBusinessAt, status: status.status,
        filename: source?.filename ?? null, coverageDate: source?.coverageDate ?? null, fingerprint: source?.fingerprint ?? null,
        deliveryId: status.received?.deliveryId ?? null, actualReceivedAt: source?.importedAt ?? null, deadlineClockReceivedAt: status.received?.businessAt ?? null, errors: status.validation.errors, csv: source?.text ?? null } }] };
    const previous = next.cases.find((item) => item.key === finding.key);
    // Repeated timer checks must not generate new detection/activity entries.
    if (!previous || previous.status === 'Resolved' || previous.message !== message || previous.verifiedClear || previous.evidence[0]?.record?.deliveryId !== (status.received?.deliveryId ?? null)) {
      registerFinding(next, finding, { scope: session.snapshot.scope, businessDate: session.snapshot.businessDate, systemAt, businessAt: effectiveAt });
    }
  }
  if (statuses.every((item) => item.status === 'Received')) {
    const signature = JSON.stringify(feedIds.map((feed) => [session.snapshot.feeds[feed]?.text, session.snapshot.feeds[feed]?.coverageDate, session.snapshot.feeds[feed]?.dateFormat ?? 'iso']));
    if (signature !== session.lastSignature) {
      const run = { ...reconcile(session.snapshot, { systemNow: systemAt }), origin: 'monitoring', monitoringId: session.id };
      next = applyRun(next, run);
      next.monitoring.session.lastSignature = signature; next.monitoring.session.lastRunId = run.id;
      audit(next, 'Monitoring recheck', `Delivered records reconciled: ${run.status}.`, systemAt);
    }
    const lastRun = next.runs.find((run) => run.id === next.monitoring.session.lastRunId);
    if (lastRun?.status === 'Passed') {
      next.cases.filter((item) => item.kind === 'delivery' && DELIVERY_FEEDS.some((feed) => item.key === caseKey(session, feed)) && !item.verifiedClear).forEach((item) => {
        item.verifiedClear = true; item.verificationRunId = lastRun.id; item.latestRunId = lastRun.id;
        recordEvent(next, 'Recovery verified', `${item.displayId}: current deliveries and financial reconciliation verified. Document resolution to close the case.`, systemAt, effectiveAt, item.id, 'System');
      });
    }
  }
  return evaluateEscalations(next, systemAt);
}

export function receiveDelivery(state, feed, text, { filename = FEEDS[feed]?.file, coverageDate, dateFormat = 'iso', importError, systemAt = new Date().toISOString(), deliveryId = crypto.randomUUID() } = {}) {
  if (!DELIVERY_FEEDS.includes(feed)) throw new Error('Only the two intermediary sources are monitored.');
  if (!state.monitoring?.active || !state.monitoring.session) throw new Error('Start or resume a monitoring window before receiving a delivery.');
  if (state.monitoring.session.processedDeliveryIds.includes(deliveryId)) return state;
  if (typeof text !== 'string' || new TextEncoder().encode(text).length >= 1024 * 1024) throw new Error('Use a text CSV smaller than 1 MB.');
  const next = structuredClone(state); const session = next.monitoring.session;
  session.snapshot.feeds[feed] = importCsv(feed, text, { filename, coverageDate, dateFormat, importedAt: systemAt });
  if (importError) session.snapshot.feeds[feed].importError = importError;
  session.receipts[feed] = { deliveryId, systemAt, businessAt: businessNow(next, systemAt), fingerprint: fingerprint(text) };
  session.processedDeliveryIds.push(deliveryId);
  session.lastSignature = null;
  // Revoke recovery permission immediately if new evidence replaces a verified delivery.
  next.cases.filter((item) => item.kind === 'delivery' && DELIVERY_FEEDS.some((id) => item.key === caseKey(session, id))).forEach((item) => { item.verifiedClear = false; });
  audit(next, 'Monitoring delivery', `${FEEDS[feed].label} received (${filename}); content validation will determine usability.`, systemAt);
  return evaluateMonitoring(next, systemAt);
}

export function withdrawDelivery(state, feed, systemAt = new Date().toISOString()) {
  if (!DELIVERY_FEEDS.includes(feed) || !state.monitoring?.active) throw new Error('Start or resume monitoring before replacing a delivery.');
  const next = structuredClone(state); const session = next.monitoring.session;
  session.snapshot.feeds[feed] = null; delete session.receipts[feed]; session.lastSignature = null;
  next.cases.filter((item) => item.kind === 'delivery' && DELIVERY_FEEDS.some((id) => item.key === caseKey(session, id))).forEach((item) => { item.verifiedClear = false; });
  audit(next, 'Monitoring replacement', `A replacement for ${FEEDS[feed].label} was selected; previous evidence was withdrawn.`, systemAt);
  return evaluateMonitoring(next, systemAt);
}

export function setMonitoringActive(state, active, systemAt = new Date().toISOString()) {
  if (!state.monitoring?.session) throw new Error('Start a monitoring window first.');
  if (state.monitoring.active === active) return state;
  const next = structuredClone(state); next.monitoring.active = active;
  audit(next, active ? 'Monitoring resumed' : 'Monitoring stopped', active ? 'Monitoring resumed; elapsed deadlines will be evaluated.' : 'Delivery monitoring stopped. Existing investigations remain open.', systemAt);
  return evaluateMonitoring(next, systemAt);
}
