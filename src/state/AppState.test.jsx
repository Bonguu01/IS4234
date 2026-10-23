import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from './AppState';
import { loadScenario } from '../data/scenarios';

const feed = 'bank_transactions';
function setup() {
  const hook = renderHook(() => useAppState(), { wrapper: AppStateProvider });
  act(() => hook.result.current.actions.loadSample('matching'));
  return hook;
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
function file(name, text, size = 100) { return { name, size, text: typeof text === 'function' ? text : async () => text }; }

describe('upload failure and concurrent input handling', () => {
  it('removes old evidence after a file-read failure so it cannot silently pass', async () => {
    const { result } = setup();
    await act(async () => result.current.actions.upload(feed, file('unreadable.csv', () => Promise.reject(new Error('File unavailable')))));
    expect(result.current.state.dataset.feeds[feed]).toBeNull();
    expect(result.current.error).toMatch(/File unavailable/);
    act(() => result.current.actions.run());
    expect(result.current.state.runs.at(-1).status).toBe('Blocked');
  });
  it('rejects the 1 MB limit without falling back to an earlier valid file', async () => {
    const { result } = setup();
    await act(async () => result.current.actions.upload(feed, file('oversize.csv', '', 1024 * 1024)));
    expect(result.current.state.dataset.feeds[feed]).toBeNull();
    expect(result.current.error).toMatch(/1 MB/);
  });
  it('blocks reconciliation while a selected file is still reading', async () => {
    const { result } = setup(); const slow = deferred(); let pending;
    act(() => { pending = result.current.actions.upload(feed, file('slow.csv', () => slow.promise)); });
    act(() => result.current.actions.run());
    expect(result.current.state.runs.at(-1).status).toBe('Blocked');
    await act(async () => { slow.resolve(loadScenario('matching').feeds[feed].text); await pending; });
    act(() => result.current.actions.run());
    expect(result.current.state.runs.at(-1).status).toBe('Passed');
  });
  it('does not let a late upload replace a newly loaded sample bundle', async () => {
    const { result } = setup(); const slow = deferred(); let pending;
    act(() => { pending = result.current.actions.upload(feed, file('slow.csv', () => slow.promise)); });
    act(() => result.current.actions.loadSample('allocation'));
    const expected = structuredClone(result.current.state.dataset);
    await act(async () => { slow.resolve(loadScenario('difference').feeds[feed].text); await pending; });
    expect(result.current.state.dataset).toEqual(expected);
  });
  it('keeps the latest selected upload when files finish in the opposite order', async () => {
    const { result } = setup(); const slow = deferred(); let pending;
    act(() => { pending = result.current.actions.upload(feed, file('older.csv', () => slow.promise)); });
    await act(async () => result.current.actions.upload(feed, file('latest.csv', loadScenario('matching').feeds[feed].text)));
    await act(async () => { slow.resolve('bad CSV'); await pending; });
    expect(result.current.state.dataset.feeds[feed].filename).toBe('latest.csv');
  });
  it('does not restore a removed file or reset workspace after a late read', async () => {
    for (const action of ['remove', 'reset']) {
      const { result, unmount } = setup(); const slow = deferred(); let pending;
      act(() => { pending = result.current.actions.upload(feed, file('slow.csv', () => slow.promise)); });
      act(() => action === 'remove' ? result.current.actions.removeFeed(feed) : result.current.actions.reset());
      await act(async () => { slow.resolve(loadScenario('matching').feeds[feed].text); await pending; });
      expect(result.current.state.dataset.feeds[feed]).toBeNull();
      unmount();
    }
  });
});

describe('monitoring integration', () => {
  it('revokes financial-case closure after changed manual evidence until a successful fresh recheck', () => {
    const { result } = setup();
    act(() => result.current.actions.loadSample('difference')); act(() => result.current.actions.run());
    act(() => result.current.actions.loadSample('corrected')); act(() => result.current.actions.run());
    expect(result.current.state.cases.every((item) => item.verifiedClear)).toBe(true);
    const id = result.current.state.cases[0].id;
    act(() => result.current.actions.caseAction(id, { type: 'assign', owner: 'Alex Carter' }));
    act(() => result.current.actions.loadSample('difference'));
    expect(result.current.state.cases.every((item) => !item.verifiedClear)).toBe(true);
    let ok;
    act(() => { ok = result.current.actions.caseAction(id, { type: 'status', status: 'Resolved', reason: 'Cannot bypass new evidence' }); });
    expect(ok).toBe(false); expect(result.current.state.cases[0].status).toBe('Open');
    act(() => result.current.actions.loadSample('corrected')); act(() => result.current.actions.run());
    act(() => { ok = result.current.actions.caseAction(id, { type: 'status', status: 'Resolved', reason: 'Fresh correction verified' }); });
    expect(ok).toBe(true);
  });
  it.each(['stop', 'reset', 'replay', 'newer-upload'])('ignores a late monitoring read superseded by %s', async (operation) => {
    const { result } = setup(); const slow = deferred(); let pending;
    const id = 'intermediary_balances'; const sample = loadScenario('matching');
    act(() => result.current.actions.startReplay('on-time'));
    act(() => { pending = result.current.actions.uploadDelivery(id, file('old.csv', () => slow.promise), '2026-10-20'); });
    if (operation === 'stop') act(() => result.current.actions.toggleMonitoring(false));
    if (operation === 'reset') act(() => result.current.actions.reset());
    if (operation === 'replay') act(() => result.current.actions.nextReplay());
    if (operation === 'newer-upload') await act(async () => result.current.actions.uploadDelivery(id, file('new.csv', sample.feeds[id].text), '2026-10-20'));
    const before = structuredClone(result.current.state);
    await act(async () => { slow.resolve('invalid old CSV'); await pending; });
    expect(result.current.state).toEqual(before);
  });
  it('an oversized replacement revokes old Passed evidence and creates an invalid delivery case', async () => {
    const { result } = setup(); const id = 'intermediary_balances';
    act(() => result.current.actions.startReplay('on-time'));
    act(() => result.current.actions.nextReplay()); act(() => result.current.actions.nextReplay());
    expect(result.current.state.runs.at(-1).status).toBe('Passed');
    await act(async () => result.current.actions.uploadDelivery(id, file('large.csv', '', 1024 * 1024), '2026-10-20'));
    expect(result.current.error).toMatch(/1 MB/);
    expect(result.current.state.monitoring.session.lastSignature).toBeNull();
    expect(result.current.state.monitoring.session.snapshot.feeds[id].importError).toMatch(/1 MB/);
    expect(result.current.state.cases[0].verifiedClear).toBe(false);
    expect(result.current.state.runs).toHaveLength(1);
  });
  it('detects overdue deliveries on the timer without running reconciliation', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
    const { result, unmount } = setup();
    try {
      act(() => result.current.actions.startMonitoring());
      act(() => vi.advanceTimersByTime(299999));
      expect(result.current.state.cases).toHaveLength(0);
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.state.cases).toHaveLength(2);
      expect(result.current.state.runs).toHaveLength(0);
      const events = result.current.state.events.length;
      act(() => vi.advanceTimersByTime(60000));
      expect(result.current.state.events).toHaveLength(events);
    } finally { unmount(); vi.useRealTimers(); }
  });
  it('registers failed delivery reads as unusable evidence and recovers with real CSV contents', async () => {
    const { result } = setup(); const id = 'intermediary_balances';
    act(() => result.current.actions.startMonitoring());
    const sample = loadScenario('matching');
    await act(async () => result.current.actions.uploadDelivery('intermediary_transactions', file('tx.csv', sample.feeds.intermediary_transactions.text), '2026-10-20'));
    await act(async () => result.current.actions.uploadDelivery(id, file('bad.csv', () => Promise.reject(new Error('Read failed'))), '2026-10-20'));
    expect(result.current.state.cases.filter((item) => item.kind === 'delivery')).toHaveLength(1);
    expect(result.current.state.cases[0].verifiedClear).toBe(false);
    expect(result.current.error).toMatch(/Read failed/);
    await act(async () => result.current.actions.uploadDelivery(id, file('good.csv', sample.feeds[id].text), '2026-10-20'));
    expect(result.current.state.runs.at(-1).status).toBe('Passed');
    expect(result.current.state.cases[0].verifiedClear).toBe(true);
  });
  it('does not let a late monitoring upload overwrite a restarted replay', async () => {
    const { result } = setup(); const slow = deferred(); let pending;
    act(() => result.current.actions.startMonitoring());
    act(() => { pending = result.current.actions.uploadDelivery('intermediary_balances', file('slow.csv', () => slow.promise), '2026-10-20'); });
    act(() => result.current.actions.startReplay('quiet'));
    const before = structuredClone(result.current.state.monitoring.session);
    await act(async () => { slow.resolve('bad CSV'); await pending; });
    expect(result.current.state.monitoring.session).toEqual(before);
  });
});
