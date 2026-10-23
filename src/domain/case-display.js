// Presentation helpers use the deadline clock, never the imported business date.
export function caseDeadline(item, now) {
  const remaining = Date.parse(item.dueBusinessAt) - Date.parse(now);
  const overdue = item.status !== 'Resolved' && Number.isFinite(remaining) && remaining <= 0;
  if (item.status === 'Resolved') return { overdue: false, label: 'Resolved — deadline no longer active' };
  if (!Number.isFinite(remaining)) return { overdue: false, label: 'Deadline unavailable' };
  const minutes = Math.floor(Math.abs(remaining) / 60000);
  const hours = Math.floor(minutes / 60);
  const duration = hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  return { overdue, label: minutes === 0 ? (overdue ? 'Deadline just reached' : 'Due in less than a minute') : `${overdue ? 'Overdue by' : 'Due in'} ${duration}` };
}

export function caseCheckLabel(item) {
  return { customers: 'Compared with bank transactions', ledger: 'Compared with intermediary transactions' }[item.checkId] ?? null;
}

export function matchesQueueView(item, view, now) {
  if (view === 'All') return true;
  if (view === 'Overdue') return caseDeadline(item, now).overdue;
  if (view === 'Escalated') return !!item.escalatedAt && item.status !== 'Resolved';
  if (view === 'Unassigned') return !item.owner && item.status !== 'Resolved';
  if (view === 'Ready to close') return !!item.owner && !!item.verifiedClear && item.status !== 'Resolved';
  return item.status === view;
}
