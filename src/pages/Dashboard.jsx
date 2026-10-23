import { Accordion, Alert, Button, Group, Table, Text } from '@mantine/core';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { useAppState } from '../state/AppState';
import { FEEDS, feedIds } from '../domain/imports';
import { assessRisk, runHref } from '../domain/risk';
import { Activity, Heading, NavigateButton, Outcome, Panel, Status, timestamp } from '../ui/shared';
import MonitoringPanel from '../ui/MonitoringPanel';
import RiskOverview from '../ui/RiskOverview';
import styles from '../ui/App.module.css';

export default function Dashboard() {
  const { state } = useAppState();
  const risk = assessRisk(state);
  const run = risk.run ?? state.runs.at(-1);
  const lastRun = state.runs.at(-1);
  const monitorChanged = lastRun?.origin === 'monitoring' && (lastRun.monitoringId !== state.monitoring?.session?.id || state.monitoring?.session?.lastSignature == null);
  return <>
    <Heading eyebrow="Control overview" title="Dashboard" description="Understand the position. See what needs action." action={<Button component="a" href="#/reconciliation?mode=manual" leftSection={<RefreshCw size={15} />}>Run reconciliation</Button>} />
    <RiskOverview />
    {monitorChanged && <Alert color="orange" mb="lg" icon={<CircleAlert size={17} />} title="Previous result — current evidence awaits recheck">The previous run does not verify the current deliveries.</Alert>}
    <MonitoringPanel compact />
    {run && <Panel title="Supporting reconciliation" action={<NavigateButton href={runHref(run)}>View checks</NavigateButton>}>
      <Group justify="space-between"><Group><Text size="xs" c="dimmed">Stored run</Text><Outcome status={run.status} /></Group><Text size="xs" c="dimmed">{run.businessDate} · {timestamp(run.systemAt)}</Text></Group>
      <Text size="xs" c="dimmed" mt="sm">{run.checks.filter((check) => !check.id.startsWith('feed:') && check.status === 'Passed').length} / 6 financial checks passed · {run.findings.length} findings. Findings may describe overlapping differences.</Text>
      <Accordion mt="sm" className={styles.quietDisclosure}><Accordion.Item value="sources"><Accordion.Control>Source coverage & freshness</Accordion.Control><Accordion.Panel>
        <Table.ScrollContainer minWidth={580}><Table><Table.Thead><Table.Tr><Table.Th>Source</Table.Th><Table.Th>Coverage date</Table.Th><Table.Th>Records</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{feedIds.map((id) => <Table.Tr key={id}><Table.Td>{FEEDS[id].label}</Table.Td><Table.Td>{run.dataset.feeds[id]?.coverageDate ?? 'Unavailable'}</Table.Td><Table.Td>{run.validation[id].rows.length}</Table.Td><Table.Td><Status value={run.validation[id].status} /></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>
      </Accordion.Panel></Accordion.Item></Accordion>
    </Panel>}
    <Accordion variant="separated" mb="lg"><Accordion.Item value="activity"><Accordion.Control>Recent activity</Accordion.Control><Accordion.Panel><Activity events={state.events} limit={3} /><NavigateButton href="exceptions">Open investigations</NavigateButton></Accordion.Panel></Accordion.Item></Accordion>
    <Text className={styles.footnote}>Synthetic demonstration · One bank, intermediary and pooled account · No real funds or banking connections.</Text>
  </>;
}
