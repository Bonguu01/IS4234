import { describe, expect, it } from 'vitest';
import { loadScenario } from '../data/scenarios';
import { reconcile } from './reconcile';
import { advanceClock, applyRun, businessNow, evaluateEscalations, initialState, updateCase } from './workflow';
import { loadState, saveState, STORAGE_KEY } from '../state/storage';

const now = '2026-10-21T12:00:00.000Z';
const run = (scenario) => reconcile(loadScenario(scenario, now), { systemNow: now });

describe('investigations', () => {
  it('deduplicates repeated findings while preserving runs and evidence', () => {
    let state = applyRun(initialState(now), run('difference'));
    const count = state.cases.length;
    state = applyRun(state, run('difference'));
    expect(state.cases).toHaveLength(count); expect(state.runs).toHaveLength(2);
  });
  it('requires assignment, correction and resolution evidence', () => {
    let state = applyRun(initialState(now), run('difference'));
    const id = state.cases[0].id;
    expect(() => updateCase(state, id, { type: 'status', status: 'Investigating' }, now)).toThrow(/owner/);
    state = updateCase(state, id, { type: 'assign', owner: 'Alex Carter' }, now);
    state = updateCase(state, id, { type: 'status', status: 'Investigating' }, now);
    state = updateCase(state, id, { type: 'note', text: 'Compared bank records.' }, now);
    expect(() => updateCase(state, id, { type: 'status', status: 'Resolved', reason: 'Done' }, now)).toThrow(/recheck/);
    state = applyRun(state, run('corrected'));
    expect(() => updateCase(state, id, { type: 'status', status: 'Resolved' }, now)).toThrow(/note/);
    state = updateCase(state, id, { type: 'status', status: 'Resolved', reason: 'Corrected source verified.' }, now);
    expect(state.cases[0].status).toBe('Resolved');
    state = applyRun(state, run('difference'));
    expect(state.cases[0].status).toBe('Open');
    expect(state.events.some((event) => event.type === 'Reopened')).toBe(true);
  });
  it('does not clear financial cases when replacement evidence is missing', () => {
    let state = applyRun(initialState(now), run('difference'));
    state = applyRun(state, run('missing'));
    expect(state.cases.find((item) => item.checkId === 'aggregate').verifiedClear).toBe(false);
  });
  it('does not clear cases using a different reconciliation date', () => {
    let state = applyRun(initialState(now), run('difference'));
    const other = run('corrected'); other.businessDate = '2026-10-22';
    state = applyRun(state, other);
    expect(state.cases.every((item) => !item.verifiedClear)).toBe(true);
  });
});

describe('independent deadline clock', () => {
  it('advances deadlines without changing financial records or actual timestamps', () => {
    let state = initialState(now); state.dataset = loadScenario('difference', now);
    state = applyRun(state, run('difference'));
    const originalDataset = structuredClone(state.dataset); const originalRun = structuredClone(state.runs[0]);
    state = advanceClock(state, 25, now);
    expect(state.dataset).toEqual(originalDataset); expect(state.runs[0]).toEqual(originalRun);
    expect(businessNow(state, now)).toBe('2026-10-22T13:00:00.000Z');
    expect(state.cases.every((item) => item.escalatedAt === now)).toBe(true);
    expect(state.events.filter((event) => event.type === 'Escalated').every((event) => event.systemAt === now && event.businessAt !== now)).toBe(true);
    const count = state.events.length;
    state = evaluateEscalations(state, now);
    expect(state.events).toHaveLength(count);
  });
  it('escalates critical feed failures immediately', () => {
    const state = applyRun(initialState(now), run('missing'));
    expect(state.cases.find((item) => item.severity === 'Critical').escalatedAt).toBe(now);
  });
  it('requires reasons for manual escalation', () => {
    let state = applyRun(initialState(now), run('difference')); const id = state.cases[0].id;
    expect(() => updateCase(state, id, { type: 'escalate' }, now)).toThrow(/reason/);
    state = updateCase(state, id, { type: 'escalate', reason: 'Request compliance review.' }, now);
    expect(state.cases[0].escalatedAt).toBe(now);
  });
});

describe('browser persistence', () => {
  it('round trips runs, assignments, notes and history', () => {
    let state = applyRun(initialState(now), run('difference')); const id = state.cases[0].id;
    state = updateCase(state, id, { type: 'assign', owner: 'Alex Carter' }, now);
    state = updateCase(state, id, { type: 'note', text: 'Evidence reviewed.' }, now);
    expect(saveState(state)).toBeNull(); expect(loadState().state).toEqual(state);
  });
  it('reports quota failures and preserves damaged storage', () => {
    expect(saveState(initialState(now), { setItem() { throw new Error('quota'); } })).toMatch(/only in memory/);
    localStorage.setItem(STORAGE_KEY, '{broken');
    expect(loadState().error).toMatch(/not been overwritten/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });
});
