import { feedIds, isDate, validateDataset } from './imports';
import { formatMoney } from './money';
import { businessNow, recordEvent } from './workflow';

export const RISK_POLICY = Object.freeze({ version: '1.0', reviewGapCents: 25000 });
export const sameScope = (a, b) => Object.keys(a).every((key) => a[key] === b[key]);
const sameWindow = (a, b) => a.businessDate === b.businessDate && sameScope(a.scope, b.scope);
const origin = (run) => run?.origin === 'monitoring' ? 'monitoring' : 'manual';
export const runHref = (run) => `reconciliation?mode=${origin(run)}&run=${encodeURIComponent(run.id)}`;
export const caseHref = (item) => `exceptions?case=${encodeURIComponent(item.id)}`;
const content = (dataset) => JSON.stringify([dataset.businessDate, Object.values(dataset.scope), feedIds.map((id) => [dataset.feeds[id]?.text, dataset.feeds[id]?.coverageDate, dataset.feeds[id]?.importError, dataset.feeds[id]?.dateFormat ?? 'iso'])]);

export function latestPosition(state) {
  let run = null;
  for (const candidate of state.runs) {
    if (isDate(candidate.businessDate) && (!run || candidate.businessDate >= run.businessDate)) run = candidate;
  }
  const session = state.monitoring?.session;
  const staged = state.dataset;
  const newerStaged = isDate(staged.businessDate) && Object.values(staged.feeds).some(Boolean) && (!run || staged.businessDate > run.businessDate);
  if (newerStaged && (!session || staged.businessDate > session.snapshot.businessDate)) {
    return { run: null, dataset: staged, origin: 'manual', changed: true };
  }
  if (session && (!run || session.snapshot.businessDate > run.businessDate || (session.snapshot.businessDate === run.businessDate &&
    (run.monitoringId === session.id || Date.parse(session.startedAt) >= Date.parse(run.systemAt))))) {
    const monitored = state.runs.find((item) => item.id === session.lastRunId);
    return { run: monitored ?? null, dataset: session.snapshot, origin: 'monitoring', changed: session.lastSignature === null || !monitored };
  }
  if (newerStaged) {
    return { run: null, dataset: staged, origin: 'manual', changed: true };
  }
  const changed = !!run && origin(run) === 'manual' && staged.businessDate === run.businessDate && content(staged) !== content(run.dataset);
  return { run, dataset: changed || !run ? staged : run.dataset, origin: origin(run), changed };
}

function customerRefs(finding) {
  if (!['transactions', 'customers', 'ledger'].includes(finding.checkId)) return [];
  const refs = finding.evidence.flatMap((entry) => entry.record?.customer_id ? [entry.record.customer_id] : []);
  if (['customers', 'ledger'].includes(finding.checkId)) refs.push(finding.entity);
  return refs;
}

export function assessRisk(state) {
  const position = latestPosition(state);
  const { run, dataset, changed } = position;
  const validation = validateDataset(dataset);
  const aggregate = run?.checks.find((check) => check.id === 'aggregate');
  const assessable = !!run && !changed && run.status !== 'Blocked' && Object.values(validation).every((feed) => feed.status === 'Ready') && aggregate?.status !== 'Blocked' && Number.isSafeInteger(aggregate?.detail?.differenceCents);
  const findings = assessable ? run.findings : [];
  const gapCents = assessable ? aggregate.detail.differenceCents : null;
  const customers = assessable ? [...new Set(findings.flatMap(customerRefs))].sort() : null;
  const allocations = findings.filter((finding) => finding.type === 'Customer allocation mismatch');
  const category = !assessable ? 'Unknown' : Math.abs(gapCents) >= RISK_POLICY.reviewGapCents || allocations.length ? 'High' : findings.length ? 'Review' : 'Clear';
  const reason = !assessable ? (!run || changed ? 'Current records need a completed recheck.' : 'A required check is blocked.')
    : allocations.length ? 'A transaction is allocated to different customers.'
    : Math.abs(gapCents) >= RISK_POLICY.reviewGapCents ? `The balance gap meets the ${formatMoney(RISK_POLICY.reviewGapCents)} review threshold.`
    : findings.length ? 'The records contain differences that need investigation.' : 'All required checks passed for these records.';
  const currentKeys = new Set(findings.map((finding) => finding.key));
  const currentCases = run ? state.cases.filter((item) => item.kind !== 'delivery' && sameWindow(item, run) && currentKeys.has(item.key)) : [];
  return { ...position, validation, assessable, gapCents, customers, allocationCount: allocations.length, category, reason, currentCases,
    businessDate: dataset.businessDate, readyCount: Object.values(validation).filter((item) => item.status === 'Ready').length };
}

export function evaluateRisk(state, systemAt = new Date().toISOString()) {
  const risk = assessRisk(state);
  if (risk.category !== 'High') return state;
  const eligible = risk.currentCases.filter((item) => item.status !== 'Resolved' && !item.verifiedClear && !item.escalatedAt);
  if (!eligible.length) return state;
  const next = structuredClone(state);
  const reason = risk.allocationCount ? `Risk policy ${RISK_POLICY.version}: transaction allocation mismatch; management review required.`
    : `Risk policy ${RISK_POLICY.version}: absolute pooled gap ${formatMoney(Math.abs(risk.gapCents))} meets ${formatMoney(RISK_POLICY.reviewGapCents)} threshold; management review required.`;
  for (const candidate of eligible) {
    const item = next.cases.find((record) => record.id === candidate.id);
    item.escalatedAt = systemAt; item.escalatedBusinessAt = businessNow(next, systemAt); item.escalationReason = reason;
    item.riskEscalation = { policyVersion: RISK_POLICY.version, runId: risk.run.id, gapCents: risk.gapCents, allocationCount: risk.allocationCount, systemAt, reason };
    recordEvent(next, 'Escalated', `${item.displayId} escalated to Risk / Compliance: ${reason}`, systemAt, item.escalatedBusinessAt, item.id, 'System', { riskPolicy: RISK_POLICY.version, runId: risk.run.id });
  }
  return next;
}

// Resolution permission belongs to verified content, not indefinitely to a case.
export function revokeStaleVerification(state, systemAt = new Date().toISOString()) {
  const stale = state.cases.filter((item) => {
    if (item.kind === 'delivery' || item.status === 'Resolved' || !item.verifiedClear) return false;
    const proof = state.runs.find((run) => run.id === item.verificationRunId);
    if (!proof) return true;
    if (origin(proof) === 'manual') return sameWindow(item, state.dataset) && content(proof.dataset) !== content(state.dataset);
    const session = state.monitoring?.session;
    return session && sameWindow(item, session.snapshot) && (session.lastSignature === null || content(proof.dataset) !== content(session.snapshot));
  });
  if (!stale.length) return state;
  const next = structuredClone(state);
  for (const previous of stale) {
    const item = next.cases.find((candidate) => candidate.id === previous.id); item.verifiedClear = false;
    recordEvent(next, 'Recheck required', `${item.displayId}: supporting inputs changed; verify the current records before closure.`, systemAt, businessNow(next, systemAt), item.id, 'System');
  }
  return next;
}

export function recommendations(state, risk = assessRisk(state), systemAt = new Date().toISOString()) {
  const unresolved = state.cases.filter((item) => item.status !== 'Resolved');
  const actions = [];
  const add = (title, detail, href) => { if (!actions.some((action) => action.href === href)) actions.push({ title, detail, href }); };
  const inputHref = `reconciliation?mode=${risk.origin}`;
  if (!risk.assessable) add(risk.readyCount < 5 ? 'Restore required records' : 'Run a fresh reconciliation', risk.readyCount < 5 ? `${risk.readyCount} of 5 sources are usable. Financial position is not assessable.` : 'The current inputs have not been verified.', inputHref);
  const current = risk.currentCases.find((item) => item.status !== 'Resolved' && item.checkId === 'transactions') ?? risk.currentCases.find((item) => item.status !== 'Resolved');
  if (risk.category === 'High' && current) add('Review with Risk / Compliance', `Review ${current.displayId} and its linked evidence. The referral is recorded in case history.`, caseHref(current));
  const unassigned = unresolved.find((item) => !item.owner && !item.verifiedClear);
  if (unassigned) add('Assign an investigation owner', `${unassigned.displayId} needs a responsible reviewer.`, caseHref(unassigned));
  const ready = unresolved.find((item) => item.verifiedClear && item.owner) ?? unresolved.find((item) => item.verifiedClear);
  if (ready) add('Document verified closure', `${ready.displayId} is corrected but remains open.`, caseHref(ready));
  const overdue = unresolved.find((item) => Date.parse(item.dueBusinessAt) <= Date.parse(businessNow(state, systemAt)));
  if (overdue) add('Review an overdue case', `${overdue.displayId} has reached its investigation deadline.`, caseHref(overdue));
  if (risk.category === 'Review' && current) add('Investigate the differences', 'Open the source evidence and record your findings.', caseHref(current));
  if (!actions.length) add('Inspect the verified checks', risk.run ? 'Review the evidence behind this position.' : 'Load a scenario to begin.', risk.run ? runHref(risk.run) : inputHref);
  return actions.slice(0, 3);
}

export function relatedCases(state, item) {
  const transactionRefs = (record) => new Set(record.evidence.flatMap((entry) => entry.record?.transaction_ref ? [entry.record.transaction_ref] : []));
  const refs = transactionRefs(item); const customers = new Set(customerRefs(item));
  return state.cases.filter((other) => other.id !== item.id && sameWindow(item, other)).flatMap((other) => {
    const sharedTx = [...transactionRefs(other)].find((ref) => refs.has(ref));
    const sharedCustomer = customerRefs(other).find((ref) => customers.has(ref));
    const reason = sharedTx ? `Shared transaction ${sharedTx}` : sharedCustomer ? `Shared customer ${sharedCustomer}`
      : item.latestRunId && item.latestRunId === other.latestRunId ? 'Same reconciliation snapshot' : null;
    return reason ? [{ item: other, reason }] : [];
  });
}
