import { useState } from 'react';
import { Accordion, Alert, Button, FileInput, Group, Menu, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { ChevronDown, Clock3, FileSpreadsheet, Pause, Play, SkipForward } from 'lucide-react';
import { useAppState } from '../state/AppState';
import { DATE_FORMATS, FEEDS, feedIds } from '../domain/imports';
import { deliveryStatuses } from '../domain/monitoring';
import { businessNow } from '../domain/workflow';
import { MONITORING_SCENARIOS } from '../data/monitoring-scenarios';
import { Activity, NavigateButton, Outcome, Panel, Status, timestamp } from './shared';
import styles from './App.module.css';

export function monitoringHealth(state) {
  if (!state.monitoring?.session) return 'Inactive';
  if (!state.monitoring.active) return 'Stopped';
  const statuses = deliveryStatuses(state);
  if (statuses.some((item) => ['Overdue', 'Stale', 'Invalid'].includes(item.status))) return 'Needs attention';
  return statuses.every((item) => item.status === 'Received') ? 'Delivery complete' : 'Awaiting records';
}

function DeliveryInput({ item, session, active }) {
  const { actions } = useAppState();
  const [date, setDate] = useState(session.snapshot.businessDate);
  const [dateFormat, setDateFormat] = useState(item.source?.dateFormat ?? 'iso');
  const [inspect, setInspect] = useState(false);
  return <div className={styles.feed}>
    <Group justify="space-between" mb="sm"><Text size="sm" fw={600}>{FEEDS[item.feed].label}</Text><Status value={item.status} /></Group>
    <Text size="xs" c="dimmed">Expected date: {session.snapshot.businessDate}</Text>
    <Text size="xs" c="dimmed" mt={4}>Received coverage: {item.source?.coverageDate || 'Not received'}</Text>
    {item.received && <Text size="xs" c="dimmed" mt={4}>{item.validation.rows.length} records · {Date.parse(item.received.businessAt) <= Date.parse(session.dueBusinessAt) ? 'Arrived within deadline' : 'Arrived after deadline'}</Text>}
    {['Invalid', 'Stale', 'Overdue'].includes(item.status) && <Text size="xs" c="red.7" mt="sm">{item.status === 'Overdue' ? 'Expected evidence has not arrived by the delivery deadline.' : item.validation.errors[0]}</Text>}
    <Select label="CSV date format for next delivery" aria-label={`${FEEDS[item.feed].label} delivery CSV date format`} description="YYYY-MM-DD is standard; MM/DD/YYYY means month first." data={DATE_FORMATS} value={dateFormat} allowDeselect={false} disabled={!active} onChange={setDateFormat} size="xs" mt="sm" />
    <FileInput label={`Upload ${FEEDS[item.feed].label.toLowerCase()} delivery`} accept=".csv,text/csv" value={null} disabled={!active} placeholder={item.source?.filename ?? 'Choose replacement CSV'} leftSection={<FileSpreadsheet size={15} />} mt="md" size="xs" onChange={(file) => actions.uploadDelivery(item.feed, file, date, dateFormat)} />
    <Group align="flex-end" mt="sm"><TextInput type="date" label="Delivery coverage date" aria-label={`${FEEDS[item.feed].label} delivery coverage date`} value={date} onChange={(event) => setDate(event.currentTarget.value)} size="xs" disabled={!active} style={{ flex: 1, minWidth: 150 }} /><Button size="compact-xs" variant="subtle" disabled={!item.source} onClick={() => setInspect(true)}>Inspect delivery</Button></Group>
    <Modal opened={inspect} onClose={() => setInspect(false)} size="xl" title={`${FEEDS[item.feed].label} delivery evidence`}><Stack><Text size="xs" c="dimmed">{item.source?.filename} · Fingerprint {item.source?.fingerprint}</Text><Text size="xs" c="dimmed">Actual receipt: {timestamp(item.received?.systemAt)}<br />Deadline-clock receipt: {timestamp(item.received?.businessAt)}</Text>{item.validation.errors.map((error, index) => <Text size="xs" c="red" key={index}>{error}</Text>)}<pre className={styles.record}>{item.source?.text}</pre></Stack></Modal>
  </div>;
}

export default function MonitoringPanel({ compact = false }) {
  const { state, actions } = useAppState();
  const [scenario, setScenario] = useState('outage'); const [snapshotOpen, setSnapshotOpen] = useState(false);
  const session = state.monitoring?.session; const statuses = deliveryStatuses(state);
  const script = MONITORING_SCENARIOS.find((item) => item.id === session?.scenario);
  const next = script?.steps[session?.replayIndex];
  const run = state.runs.find((item) => item.id === session?.lastRunId);
  const currentRun = session?.lastSignature !== null && statuses.length > 0 && statuses.every((item) => item.status === 'Received') ? run : null;
  const unresolved = state.cases.filter((item) => item.kind === 'delivery' && item.status !== 'Resolved');
  return <Panel title="Daily delivery monitoring" action={<Status value={monitoringHealth(state)} />}>
    {!compact && <Text size="sm" c="dimmed" mb="md">Check that both daily files arrive—even when there are no transactions.</Text>}
    {compact ? <>
      {session ? <Group justify="space-between" align="flex-start"><div><Text size="sm" fw={550}>{session.snapshot.businessDate} · {statuses.filter((item) => item.status === 'Received').length} / 2 files usable</Text><Text size="xs" c="dimmed" mt={5}>Deadline: {timestamp(session.dueBusinessAt)} · {unresolved.length} open delivery cases</Text></div><div><Text size="xs" c="dimmed" mb={6}>Financial snapshot</Text>{currentRun ? <Outcome status={currentRun.status} /> : <Text size="sm">Awaiting usable records</Text>}</div></Group> : <Text size="sm" c="dimmed">Start a monitoring window to detect late or unusable daily files.</Text>}
      <Group justify="space-between" mt="md"><NavigateButton href="reconciliation?mode=monitoring">Open delivery monitor</NavigateButton>{unresolved.length > 0 && <NavigateButton href="exceptions">Investigate delivery cases</NavigateButton>}</Group>
    </> : <>
      <Group align="flex-end" mb="sm"><Select label="Monitoring scenario" data={MONITORING_SCENARIOS.map((item) => ({ value: item.id, label: item.label }))} value={scenario} onChange={setScenario} allowDeselect={false} style={{ flex: 1, minWidth: 230 }} /><Button leftSection={<Play size={15} />} onClick={() => actions.startReplay(scenario)}>Start monitoring demo</Button><Button variant="default" onClick={actions.startMonitoring}>Monitor staged bank records</Button></Group>
      <Text size="xs" c="dimmed" mb="md">{MONITORING_SCENARIOS.find((item) => item.id === scenario)?.description} Manual uploads remain separate.</Text>
      {session && <>
        <Group gap="xl" align="flex-start" mb="lg"><div><Text size="xs" c="dimmed">Expected business date</Text><Text size="sm" fw={600} mt={4}>{session.snapshot.businessDate}</Text></div><div><Text size="xs" c="dimmed">Delivery deadline · simulated</Text><Text size="sm" fw={600} mt={4}>{timestamp(session.dueBusinessAt)}</Text></div><div><Text size="xs" c="dimmed">Current deadline clock</Text><Text size="sm" mt={4}>{timestamp(businessNow(state))}</Text></div><div><Text size="xs" c="dimmed" mb={5}>Current financial recheck</Text>{currentRun ? <Outcome status={currentRun.status} /> : <Text size="sm">Not assessed yet</Text>}</div></Group>
        <Group mb="sm"><Button variant="light" leftSection={<SkipForward size={15} />} disabled={!next || !state.monitoring.active} onClick={actions.nextReplay}>Next replay event</Button>
          <Menu position="bottom-end" withinPortal><Menu.Target><Button variant="default" rightSection={<ChevronDown size={14} />}>Window actions</Button></Menu.Target><Menu.Dropdown>
            <Menu.Item leftSection={<Clock3 size={15} />} onClick={() => actions.advance(5 / 60)}>Advance 5 minutes</Menu.Item>
            <Menu.Item leftSection={state.monitoring.active ? <Pause size={15} /> : <Play size={15} />} onClick={() => actions.toggleMonitoring(!state.monitoring.active)}>{state.monitoring.active ? 'Stop monitoring' : 'Resume monitoring'}</Menu.Item>
            <Menu.Divider /><Menu.Item leftSection={<FileSpreadsheet size={15} />} onClick={() => setSnapshotOpen(true)}>Inspect monitored snapshot</Menu.Item>
          </Menu.Dropdown></Menu>
        </Group>
        <Text size="xs" c="dimmed" mb="lg">{next ? `Next: +${next.minute} min — ${next.label}.` : session.scenario ? 'Replay complete. Review results or upload replacement evidence.' : 'Custom monitoring: upload both intermediary sources below.'} Stepping never moves the clock backwards.</Text>
        {!state.monitoring.active && <Alert color="gray" title="Monitoring stopped" mb="md">No new delivery failures are detected while stopped. Existing cases remain open and the shared deadline clock continues. Resume to evaluate elapsed deadlines.</Alert>}
        <div className={styles.deliveryGrid}>{statuses.map((item) => <DeliveryInput key={`${session.id}:${item.feed}`} item={item} session={session} active={state.monitoring.active} />)}</div>
        <Group justify="space-between" mt="lg"><Text size="xs" c="dimmed" maw={650}>Both files must be usable for automatic reconciliation. Delivery cases need a Passed recheck before closure.</Text><NavigateButton href="exceptions">Open investigations</NavigateButton></Group>
        <Accordion className={styles.quietDisclosure}><Accordion.Item value="activity"><Accordion.Control>Monitoring activity</Accordion.Control><Accordion.Panel><Activity events={state.events.filter((item) => item.monitoringId === session.id)} limit={6} /></Accordion.Panel></Accordion.Item></Accordion>
      </>}
      <Text className={styles.footnote}>Demo policy: five-minute window. Checks run while open and on reopening; no banking connection.</Text>
    </>}
    <Modal opened={snapshotOpen} onClose={() => setSnapshotOpen(false)} title="Monitored snapshot — separate from manual uploads" size="xl">{session && <Stack><Text size="sm">Expected business date: {session.snapshot.businessDate}</Text>{feedIds.map((feed) => <div key={feed}><Text fw={600} size="sm">{FEEDS[feed].label}</Text><Text size="xs" c="dimmed">{session.snapshot.feeds[feed]?.filename ?? 'Unavailable'}</Text><pre className={styles.record}>{session.snapshot.feeds[feed]?.text ?? 'Not received'}</pre></div>)}</Stack>}</Modal>
  </Panel>;
}
