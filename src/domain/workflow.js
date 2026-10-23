import { feedIds, SCOPE } from './imports';

export const STAFF = ['Alex Carter', 'Priya Shah', 'Daniel Park', 'Maria Lopez'];
export const SLA_MS = 24 * 60 * 60 * 1000;

export function initialState(systemNow = new Date().toISOString()) {
  return { version: 2, dataset: { name: 'Manual records', scope: { ...SCOPE }, businessDate: systemNow.slice(0, 10), feeds: Object.fromEntries(feedIds.map((id) => [id, null])) },
    runs: [], cases: [], events: [], monitoring: { active: false, session: null }, clock: { baseSystemAt: systemNow, baseBusinessAt: systemNow } };
}

export function businessNow(state, systemNow = new Date().toISOString()) {
  return new Date(Date.parse(state.clock.baseBusinessAt) + Date.parse(systemNow) - Date.parse(state.clock.baseSystemAt)).toISOString();
}

export function recordEvent(state, type, message, systemAt, businessAt, caseId = null, actor = 'Demo analyst', metadata = {}) {
  state.events.push({ id: crypto.randomUUID(), type, message, systemAt, businessAt, caseId, actor, ...metadata });
}
const event = recordEvent;

function sameWindow(a, b) { return a.businessDate === b.businessDate && JSON.stringify(a.scope) === JSON.stringify(b.scope); }

// Both reconciliation and delivery monitoring use the same investigation lifecycle.
export function registerFinding(state, finding, { scope, businessDate, systemAt, businessAt, runId = null }) {
  let item = state.cases.find((candidate) => candidate.key === finding.key);
  if (!item) {
    item = { ...finding, id: crypto.randomUUID(), displayId: `EX-${String(state.cases.length + 1).padStart(3, '0')}`, scope, businessDate,
      status: 'Open', owner: '', notes: [], firstDetectedAt: systemAt, openedBusinessAt: businessAt,
      dueBusinessAt: new Date(Date.parse(businessAt) + (finding.severity === 'Critical' ? 0 : SLA_MS)).toISOString(), escalatedAt: null };
    state.cases.push(item);
    event(state, 'Detected', `${item.displayId}: ${finding.message}`, systemAt, businessAt, item.id, 'System');
  } else if (item.status === 'Resolved') {
    item.status = 'Open'; item.escalatedAt = null; item.escalatedBusinessAt = null;
    delete item.riskEscalation;
    item.openedBusinessAt = businessAt;
    item.dueBusinessAt = new Date(Date.parse(businessAt) + (finding.severity === 'Critical' ? 0 : SLA_MS)).toISOString();
    event(state, 'Reopened', `${item.displayId}: finding detected again.`, systemAt, businessAt, item.id, 'System');
  }
  Object.assign(item, finding, { lastDetectedAt: systemAt, latestRunId: runId, verifiedClear: false, verificationRunId: runId });
  return item;
}

export function evaluateEscalations(state, systemAt = new Date().toISOString()) {
  const next = structuredClone(state); const effectiveAt = businessNow(next, systemAt);
  next.cases.forEach((item) => {
    if (item.status === 'Resolved' || item.escalatedAt || Date.parse(effectiveAt) < Date.parse(item.dueBusinessAt)) return;
    item.escalatedAt = systemAt; item.escalatedBusinessAt = effectiveAt; item.escalationReason = item.severity === 'Critical' ? 'Critical source failure' : '24-hour investigation deadline exceeded';
    event(next, 'Escalated', `${item.displayId} escalated to Risk / Compliance: ${item.escalationReason}.`, systemAt, effectiveAt, item.id, 'System');
  });
  return next;
}

export function applyRun(state, run) {
  const next = structuredClone(state); const effectiveAt = businessNow(next, run.systemAt);
  next.runs.push(run);
  event(next, 'Reconciliation', `Run ${next.runs.length}: ${run.status}; ${run.findings.length} finding(s).`, run.systemAt, effectiveAt);
  const current = new Map(run.findings.map((finding) => [finding.key, finding]));
  next.cases.filter((item) => item.kind !== 'delivery' && sameWindow(item, run)).forEach((item) => {
    const check = run.checks.find((candidate) => candidate.id === item.checkId);
    item.verifiedClear = !current.has(item.key) && !!check && check.status !== 'Blocked';
    item.verificationRunId = run.id;
    item.latestRunId = run.id;
  });
  run.findings.forEach((finding) => {
    registerFinding(next, finding, { scope: run.scope, businessDate: run.businessDate, systemAt: run.systemAt, businessAt: effectiveAt, runId: run.id });
  });
  return evaluateEscalations(next, run.systemAt);
}

export function updateCase(state, caseId, action, systemAt = new Date().toISOString()) {
  const next = structuredClone(state); const item = next.cases.find((candidate) => candidate.id === caseId);
  if (!item) throw new Error('Case not found.');
  const effectiveAt = businessNow(next, systemAt);
  if (action.type === 'assign') {
    if (!STAFF.includes(action.owner)) throw new Error('Select a staff member.');
    item.owner = action.owner;
    event(next, 'Assigned', `${item.displayId} assigned to ${item.owner}.`, systemAt, effectiveAt, caseId);
  } else if (action.type === 'note') {
    if (!action.text?.trim()) throw new Error('Enter an investigation note.');
    item.notes.push({ text: action.text.trim(), systemAt, businessAt: effectiveAt, actor: 'Demo analyst' });
    event(next, 'Note', action.text.trim(), systemAt, effectiveAt, caseId);
  } else if (action.type === 'status') {
    if (!['Open', 'Investigating', 'Resolved'].includes(action.status)) throw new Error('Invalid status.');
    if (action.status === 'Investigating' && !item.owner) throw new Error('Assign an owner before investigating.');
    if (action.status === 'Resolved') {
      if (!item.owner) throw new Error('Assign an owner before resolution.');
      if (!action.reason?.trim()) throw new Error('A resolution note is required.');
      if (!item.verifiedClear) throw new Error('Correct the underlying records and run a successful applicable recheck first.');
      item.resolution = { note: action.reason.trim(), systemAt, businessAt: effectiveAt, runId: item.verificationRunId };
    }
    event(next, 'Status', `${item.displayId}: ${item.status} → ${action.status}${action.reason ? `. ${action.reason.trim()}` : ''}`, systemAt, effectiveAt, caseId);
    item.status = action.status;
  } else if (action.type === 'escalate') {
    if (item.status === 'Resolved') throw new Error('Resolved cases cannot be escalated.');
    if (item.escalatedAt) throw new Error('This case has already been escalated.');
    if (!action.reason?.trim()) throw new Error('An escalation reason is required.');
    item.escalatedAt = systemAt; item.escalatedBusinessAt = effectiveAt; item.escalationReason = action.reason.trim();
    event(next, 'Escalated', `${item.displayId} escalated to Risk / Compliance: ${item.escalationReason}`, systemAt, effectiveAt, caseId);
  } else throw new Error('Unknown case action.');
  return evaluateEscalations(next, systemAt);
}

export function advanceClock(state, hours, systemAt = new Date().toISOString()) {
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 365) throw new Error('Advance by 1–8760 hours.');
  const next = structuredClone(state);
  next.clock = { baseSystemAt: systemAt, baseBusinessAt: new Date(Date.parse(businessNow(state, systemAt)) + hours * 3600000).toISOString() };
  event(next, 'Demo clock', `Advanced deadline clock by ${hours} hours. Reconciliation dates and records unchanged.`, systemAt, next.clock.baseBusinessAt);
  return evaluateEscalations(next, systemAt);
}
