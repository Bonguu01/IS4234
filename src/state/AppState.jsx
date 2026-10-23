import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FEEDS, importCsv } from '../domain/imports';
import { reconcile } from '../domain/reconcile';
import { advanceClock, applyRun, initialState, updateCase } from '../domain/workflow';
import { loadScenario } from '../data/scenarios';
import { loadState, saveState } from './storage';
import { evaluateMonitoring, receiveDelivery, setMonitoringActive, startMonitoring, withdrawDelivery } from '../domain/monitoring';
import { nextReplayEvent, startReplay } from '../data/monitoring-scenarios';
import { evaluateRisk, revokeStaleVerification } from '../domain/risk';

const Context = createContext(null);
export function AppStateProvider({ children }) {
  const [loaded] = useState(() => loadState());
  const [state, setState] = useState(loaded.state);
  const [error, setError] = useState(loaded.error);
  const blockedStorage = useRef(!!loaded.error);
  const latest = useRef(state);
  const uploadRequests = useRef({});
  const workspaceGeneration = useRef(0);
  const monitoringRequests = useRef({});
  const monitoringGeneration = useRef(0);
  const commit = useCallback((transform) => {
    try {
      const next = evaluateRisk(revokeStaleVerification(transform(revokeStaleVerification(latest.current))));
      latest.current = next; setState(next);
      if (!blockedStorage.current) setError(saveState(next));
      return true;
    } catch (cause) { setError(cause.message); return false; }
  }, []);
  useEffect(() => {
    const evaluate = () => {
      const next = evaluateRisk(revokeStaleVerification(evaluateMonitoring(latest.current)));
      if (next.events.length !== latest.current.events.length) commit(() => next);
    };
    evaluate();
    const interval = window.setInterval(evaluate, 15000);
    return () => window.clearInterval(interval);
  }, [commit]);
  const actions = {
    loadSample: (id) => { workspaceGeneration.current += 1; return commit((current) => ({ ...current, dataset: loadScenario(id) })); },
    setBusinessDate: (businessDate) => commit((current) => ({ ...current, dataset: { ...current.dataset, businessDate } })),
    setCoverage: (id, coverageDate) => commit((current) => ({ ...current, dataset: { ...current.dataset, name: 'Manual records', feeds: { ...current.dataset.feeds, [id]: current.dataset.feeds[id] ? { ...current.dataset.feeds[id], coverageDate } : null } } })),
    setDateFormat: (id, dateFormat) => commit((current) => ({ ...current, dataset: { ...current.dataset, name: 'Manual records', feeds: { ...current.dataset.feeds, [id]: current.dataset.feeds[id] ? { ...current.dataset.feeds[id], dateFormat } : null } } })),
    upload: async (id, file, dateFormat = 'iso') => {
      if (!file) return;
      const request = (uploadRequests.current[id] ?? 0) + 1;
      uploadRequests.current[id] = request;
      const generation = workspaceGeneration.current;
      const coverageDate = latest.current.dataset.businessDate;
      const stillCurrent = () => request === uploadRequests.current[id] && generation === workspaceGeneration.current;
      // A newly selected file supersedes prior evidence immediately, even if reading fails.
      commit((current) => ({ ...current, dataset: { ...current.dataset, name: 'Manual records', feeds: { ...current.dataset.feeds, [id]: null } } }));
      try {
        if (file.size >= 1024 * 1024) throw new Error('Use synthetic CSV files smaller than 1 MB each.');
        const text = await file.text();
        if (!stillCurrent()) return;
        commit((current) => ({ ...current, dataset: { ...current.dataset, name: 'Manual records', feeds: { ...current.dataset.feeds, [id]: importCsv(id, text, { filename: file.name, coverageDate, dateFormat }) } } }));
      } catch (cause) { if (stillCurrent()) setError(`Upload failed: ${cause.message} Previous evidence for this source was removed; select a usable file and rerun.`); }
    },
    removeFeed: (id) => { uploadRequests.current[id] = (uploadRequests.current[id] ?? 0) + 1; return commit((current) => ({ ...current, dataset: { ...current.dataset, name: 'Manual records', feeds: { ...current.dataset.feeds, [id]: null } } })); },
    run: () => commit((current) => applyRun(current, reconcile(current.dataset))),
    caseAction: (id, action) => commit((current) => updateCase(current, id, action)),
    advance: (hours) => commit((current) => evaluateMonitoring(advanceClock(current, hours))),
    startReplay: (id) => { monitoringGeneration.current += 1; return commit((current) => startReplay(current, id)); },
    startMonitoring: () => { monitoringGeneration.current += 1; return commit((current) => startMonitoring(current, current.dataset)); },
    nextReplay: () => { monitoringGeneration.current += 1; return commit((current) => nextReplayEvent(current)); },
    toggleMonitoring: (active) => { monitoringGeneration.current += 1; return commit((current) => setMonitoringActive(current, active)); },
    uploadDelivery: async (id, file, coverageDate, dateFormat = 'iso') => {
      if (!file) return;
      const request = (monitoringRequests.current[id] ?? 0) + 1; monitoringRequests.current[id] = request;
      const generation = monitoringGeneration.current;
      const currentRequest = () => request === monitoringRequests.current[id] && generation === monitoringGeneration.current;
      if (!commit((current) => withdrawDelivery(current, id))) return;
      try {
        if (file.size >= 1024 * 1024) throw new Error('Use synthetic CSV files smaller than 1 MB each.');
        const text = await file.text();
        if (currentRequest()) commit((current) => receiveDelivery(current, id, text, { filename: file.name, coverageDate, dateFormat }));
      } catch (cause) {
        if (currentRequest()) {
          commit((current) => receiveDelivery(current, id, '', { filename: file.name || FEEDS[id].file, coverageDate, importError: cause.message }));
          setError(`Delivery upload failed: ${cause.message} The previous source is not used.`);
        }
      }
    },
    reset: () => { workspaceGeneration.current += 1; monitoringGeneration.current += 1; blockedStorage.current = false; return commit(() => initialState()); },
    dismissError: () => { if (!blockedStorage.current) setError(null); },
  };
  return <Context.Provider value={{ state, actions, error }}>{children}</Context.Provider>;
}
export function useAppState() { return useContext(Context); }
