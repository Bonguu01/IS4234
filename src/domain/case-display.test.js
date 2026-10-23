import { describe, expect, it } from 'vitest';
import { caseCheckLabel, caseDeadline, matchesQueueView } from './case-display';

const item = { status: 'Open', dueBusinessAt: '2026-10-21T08:00:00Z', owner: '', escalatedAt: null, verifiedClear: false };
describe('case deadline presentation and queue views', () => {
  it('marks overdue exactly at deadline, with elapsed hours and minutes afterwards', () => {
    expect(caseDeadline(item, '2026-10-21T07:59:59Z')).toEqual({ overdue: false, label: 'Due in less than a minute' });
    expect(caseDeadline(item, item.dueBusinessAt)).toEqual({ overdue: true, label: 'Deadline just reached' });
    expect(caseDeadline(item, '2026-10-22T09:15:00Z')).toEqual({ overdue: true, label: 'Overdue by 25h 15m' });
  });
  it('does not confuse escalation with overdue or remove overdue when correction is verified', () => {
    expect(caseDeadline({ ...item, escalatedAt: '2026-10-20', verifiedClear: true }, '2026-10-21T07:00:00Z').overdue).toBe(false);
    expect(caseDeadline({ ...item, verifiedClear: true }, '2026-10-22T08:00:00Z').overdue).toBe(true);
  });
  it('removes active overdue after resolution without changing deadline data', () => {
    const resolved = { ...item, status: 'Resolved' };
    expect(caseDeadline(resolved, '2026-10-22T08:00:00Z').overdue).toBe(false);
    expect(resolved.dueBusinessAt).toBe(item.dueBusinessAt);
  });
  it('handles invalid deadlines without inventing an overdue result', () => {
    expect(caseDeadline({ ...item, dueBusinessAt: '' }, '2026-10-22').overdue).toBe(false);
  });
  it('filters overlapping queue flags independently from workflow status', () => {
    const now = '2026-10-22T08:00:00Z';
    expect(matchesQueueView(item, 'Overdue', now)).toBe(true);
    expect(matchesQueueView(item, 'Unassigned', now)).toBe(true);
    expect(matchesQueueView(item, 'Escalated', now)).toBe(false);
    expect(matchesQueueView(item, 'Ready to close', now)).toBe(false);
    expect(matchesQueueView({ ...item, owner: 'Alex Carter', verifiedClear: true }, 'Ready to close', now)).toBe(true);
    for (const view of ['Overdue', 'Escalated', 'Unassigned', 'Ready to close']) {
      expect(matchesQueueView({ ...item, status: 'Resolved', escalatedAt: now }, view, now)).toBe(false);
    }
  });
  it('labels the two customer checks distinctly without renaming the finding', () => {
    expect(caseCheckLabel({ checkId: 'customers' })).toBe('Compared with bank transactions');
    expect(caseCheckLabel({ checkId: 'ledger' })).toBe('Compared with intermediary transactions');
    expect(caseCheckLabel({ checkId: 'aggregate' })).toBeNull();
  });
});
