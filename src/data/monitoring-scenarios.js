import Papa from 'papaparse';
import { loadScenario } from './scenarios';
import { FEEDS, importCsv } from '../domain/imports';
import { advanceClock, businessNow } from '../domain/workflow';
import { evaluateMonitoring, receiveDelivery, startMonitoring } from '../domain/monitoring';

const step = (minute, label, feed = null, source = 'matching') => ({ minute, label, feed, source });
export const MONITORING_SCENARIOS = [
  { id: 'on-time', label: 'On-time delivery', description: 'Both expected sources arrive before the deadline; reconciliation runs automatically.', steps: [step(1, 'Receive intermediary transactions', 'intermediary_transactions'), step(2, 'Receive customer balances and reconcile', 'intermediary_balances')] },
  { id: 'outage', label: 'Missing delivery and recovery', description: 'The closing ledger misses its deadline, then arrives for verified recovery.', steps: [step(1, 'Receive intermediary transactions', 'intermediary_transactions'), step(5, 'Reach the closing-ledger deadline'), step(6, 'Receive the missing ledger and recheck', 'intermediary_balances')] },
  { id: 'invalid', label: 'Invalid delivery and recovery', description: 'An unusable amount triggers a case; corrected records are rechecked.', steps: [step(1, 'Receive intermediary transactions', 'intermediary_transactions'), step(2, 'Receive invalid customer balances', 'intermediary_balances', 'invalid'), step(3, 'Receive corrected balances and recheck', 'intermediary_balances')] },
  { id: 'stale', label: 'Stale delivery and recovery', description: 'Yesterday’s ledger cannot verify the expected business date.', steps: [step(1, 'Receive intermediary transactions', 'intermediary_transactions'), step(2, 'Receive yesterday’s customer balances', 'intermediary_balances', 'stale'), step(3, 'Receive current balances and recheck', 'intermediary_balances')] },
  { id: 'quiet', label: 'Quiet day with zero transactions', description: 'Valid zero-activity data still counts as delivery; no false outage is raised.', steps: [step(1, 'Receive a zero-activity transaction file', 'intermediary_transactions', 'quiet'), step(2, 'Receive unchanged customer balances', 'intermediary_balances', 'quiet')] },
  { id: 'difference', label: 'Delivered records with a discrepancy', description: 'Both feeds are available, but the financial records disagree by $400.', steps: [step(1, 'Receive intermediary transactions', 'intermediary_transactions', 'difference'), step(2, 'Receive balances and detect the difference', 'intermediary_balances', 'difference')] },
];

function replace(dataset, feed, rows) {
  const source = dataset.feeds[feed];
  const parsed = Papa.parse(source.text, { header: true });
  dataset.feeds[feed] = importCsv(feed, Papa.unparse({ fields: parsed.meta.fields, data: rows }), source);
}
function payload(kind, systemAt, expectedDate) {
  const dataset = loadScenario(kind === 'difference' ? 'difference' : 'matching', systemAt);
  if (kind === 'quiet') {
    replace(dataset, 'bank_transactions', []); replace(dataset, 'intermediary_transactions', []);
    const bank = Papa.parse(dataset.feeds.bank_balances.text, { header: true }).data;
    bank[0].closing_balance = bank[0].opening_balance; replace(dataset, 'bank_balances', bank);
    const balances = Papa.parse(dataset.feeds.intermediary_balances.text, { header: true }).data;
    balances[0].closing_balance = '1000.00'; balances[1].closing_balance = '2000.00'; replace(dataset, 'intermediary_balances', balances);
  }
  if (expectedDate) {
    dataset.businessDate = expectedDate;
    for (const [feed, source] of Object.entries(dataset.feeds)) {
      const parsed = Papa.parse(source.text, { header: true, skipEmptyLines: 'greedy' });
      const date = kind === 'stale' && feed === 'intermediary_balances' ? new Date(Date.parse(expectedDate + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10) : expectedDate;
      parsed.data.forEach((row) => { row.business_date = date; });
      dataset.feeds[feed] = importCsv(feed, Papa.unparse({ fields: parsed.meta.fields, data: parsed.data }), { ...source, coverageDate: date });
    }
  }
  if (kind === 'invalid') dataset.feeds.intermediary_balances.text = dataset.feeds.intermediary_balances.text.replace('1500.00', '1500.001');
  return dataset;
}

export function startReplay(state, scenarioId, systemAt = new Date().toISOString()) {
  if (!MONITORING_SCENARIOS.some((item) => item.id === scenarioId)) throw new Error('Unknown monitoring scenario.');
  return startMonitoring(state, payload(scenarioId === 'quiet' ? 'quiet' : 'matching', systemAt), { scenario: scenarioId, systemAt });
}

export function nextReplayEvent(state, systemAt = new Date().toISOString()) {
  const session = state.monitoring?.session;
  if (!session || !state.monitoring.active) throw new Error('Start or resume a monitoring demo first.');
  const scenario = MONITORING_SCENARIOS.find((item) => item.id === session.scenario);
  const event = scenario?.steps[session.replayIndex];
  if (!event) throw new Error('No replay events remain. Start another demo or upload a delivery.');
  const target = Date.parse(session.startedBusinessAt) + event.minute * 60000;
  const remainingHours = (target - Date.parse(businessNow(state, systemAt))) / 3600000;
  let next = remainingHours > 0 ? advanceClock(state, remainingHours, systemAt) : structuredClone(state);
  if (event.feed) {
    const source = payload(event.source, systemAt, session.snapshot.businessDate).feeds[event.feed];
    next = receiveDelivery(next, event.feed, source.text, { filename: FEEDS[event.feed].file, coverageDate: source.coverageDate, systemAt, deliveryId: `${session.id}:${session.replayIndex}` });
  } else next = evaluateMonitoring(next, systemAt);
  next.monitoring.session.replayIndex += 1;
  return next;
}
