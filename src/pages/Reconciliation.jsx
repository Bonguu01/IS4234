import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Group, Modal, Select, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { Download, Play, Upload } from 'lucide-react';
import { useAppState } from '../state/AppState';
import { FEEDS, validateDataset } from '../domain/imports';
import { SCENARIOS } from '../data/scenarios';
import { formatMoney } from '../domain/money';
import { Empty, Heading, Outcome, Panel, Status, timestamp } from '../ui/shared';
import styles from '../ui/App.module.css';
import MonitoringPanel from '../ui/MonitoringPanel';
import CheckResults from '../ui/CheckResults';
import { DEMO_TALKING_POINTS } from '../ui/DemoGuide';
import { caseHref } from '../domain/risk';
import SourceRecords from '../ui/SourceRecords';

function downloadFile(source) {
  const url = URL.createObjectURL(new Blob([source.text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = source.filename; a.click(); URL.revokeObjectURL(url);
}

export default function Reconciliation({ requestedMode = null, requestedRunId = null }) {
  const { state, actions } = useAppState();
  const [scenario, setScenario] = useState('matching');
  const [sourceView, setSourceView] = useState(null);
  useEffect(() => { const loaded = SCENARIOS.find((item) => item.label === state.dataset.name); if (loaded) setScenario(loaded.id); }, [state.dataset.name]);
  const mode = requestedMode ?? (state.monitoring?.session ? 'monitoring' : 'manual');
  const validation = useMemo(() => validateDataset(state.dataset), [state.dataset]);
  const run = state.runs.find((item) => item.id === requestedRunId) ?? state.runs.at(-1);
  useEffect(() => { if (requestedRunId) document.getElementById('reconciliation-results')?.scrollIntoView({ behavior: 'instant', block: 'start' }); }, [requestedRunId]);
  const selectRun = (id) => { window.location.hash = `/reconciliation?mode=${mode}${id ? `&run=${encodeURIComponent(id)}` : ''}`; };
  const differs = run && JSON.stringify(run.dataset) !== JSON.stringify(state.dataset);
  const selectedSource = sourceView ? state.dataset.feeds[sourceView] : null;
  const selectedValidation = sourceView ? validation[sourceView] : null;
  const readyCount = Object.values(validation).filter((item) => item.status === 'Ready').length;
  const outcomeCopy = {
    Passed: ['Records agree for this run', 'All required checks passed. Existing cases still need documented closure in Exceptions.'],
    Exceptions: ['Differences need investigation', 'Review the failed comparisons below, then assign and investigate the generated cases.'],
    Blocked: ['Required checks could not complete', 'Restore missing, stale or invalid evidence, or correct the blocked calculation, then recheck. A blocked result does not establish financial agreement.'],
  };
  return <>
    <Heading eyebrow="Record assurance" title="Reconciliation" description="Load records. Compare them. Review the results." />
    {requestedRunId && !state.runs.some((item) => item.id === requestedRunId) && <Alert color="orange" mb="lg" title="Run unavailable">This run is not in the current workspace. Showing the latest stored result.</Alert>}
    <Tabs value={mode} onChange={(value) => { window.location.hash = `/reconciliation?mode=${value}`; }} keepMounted={false}>
      <Tabs.List mb="lg"><Tabs.Tab value="manual">Manual CSV records</Tabs.Tab><Tabs.Tab value="monitoring">Delivery monitoring</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="manual">
    <Panel title="Prepare source records" action={<Badge color={readyCount === 5 ? 'ledger' : 'gray'}>{readyCount} / 5 sources ready</Badge>}>
      <Group align="flex-end" mb="sm"><Select label="Sample scenario" aria-label="Sample scenario" data={SCENARIOS.map(({ id, label }) => ({ value: id, label }))} value={scenario} onChange={setScenario} allowDeselect={false} style={{ flex: 1, minWidth: 220 }} />
        <Button leftSection={<Upload size={15} />} onClick={() => { actions.loadSample(scenario); selectRun(null); }}>Load Sample Scenario</Button>
        <TextInput type="date" label="Reconciliation business date" value={state.dataset.businessDate} onChange={(event) => actions.setBusinessDate(event.currentTarget.value)} w={210} />
      </Group>
      <Text size="sm" c="dimmed" mb="lg">{DEMO_TALKING_POINTS[scenario]} Load the files, then run checks.</Text>
      <SourceRecords validation={validation} onInspect={setSourceView} />
      <Group justify="space-between" mt="lg" align="center"><Text size="xs" c="dimmed" maw={580}>Coverage is checked against the business date. Missing evidence blocks reconciliation.</Text><Button leftSection={<Play size={15} />} onClick={() => { actions.run(); selectRun(null); document.getElementById('reconciliation-results')?.scrollIntoView({ behavior: 'instant', block: 'start' }); }}>Run reconciliation</Button></Group>
    </Panel>
    <Text size="xs" c="dimmed" mb="lg">Synthetic customer-linked bank records are a proposed control, not a claim about Evolve’s actual systems.</Text>
      </Tabs.Panel>
      <Tabs.Panel value="monitoring"><MonitoringPanel /></Tabs.Panel>
    </Tabs>
    <Panel id="reconciliation-results" title="Reconciliation results" action={state.runs.length > 0 && <Select aria-label="View reconciliation run" size="xs" w={320} maw="100%" value={run?.id} data={[...state.runs].reverse().map((item, index) => ({ value: item.id, label: `Run ${state.runs.length - index} · ${item.origin === 'monitoring' ? 'Monitor' : 'Manual'} · ${item.businessDate} · ${item.status}` }))} onChange={selectRun} allowDeselect={false} />}>
      {!run ? <Empty title="No financial checks run yet" description={mode === 'monitoring' ? 'Deliver both usable intermediary sources. The monitored snapshot will be reconciled automatically.' : 'Load a sample scenario or upload CSV records, then run reconciliation.'} /> : <>
        <div className={styles.resultBanner} data-outcome={run.status}>
          <Group justify="space-between" mb="sm"><Outcome status={run.status} /><Text size="xs" c="dimmed">{run.id === state.runs.at(-1)?.id ? 'Latest stored run' : 'Historical run'} · {run.origin === 'monitoring' ? 'Automatic monitoring' : 'Manual CSV records'}</Text></Group>
          <Text fw={650} size="lg">{outcomeCopy[run.status][0]}</Text><Text size="sm" mt={5}>{outcomeCopy[run.status][1]}</Text>
          <Group gap="xl" mt="md"><Text size="xs" c="dimmed">Business date {run.businessDate}</Text><Text size="xs" c="dimmed">Actual execution: {timestamp(run.systemAt)}</Text></Group>
        </div>
        {run.origin === 'monitoring' ? <Text size="xs" c="dimmed" mb="md">Automatic monitoring snapshot · Manual uploads are separate. New deliveries require their own recheck.</Text> : differs && <Alert color="orange" mb="md" title="Staged records differ from this run">Run reconciliation to assess the staged inputs.</Alert>}
        <CheckResults checks={run.checks} />
        {run.findings.length > 0 && <><Group justify="space-between" mt="xl" mb="md"><Text size="sm" fw={600}>Detected findings ({run.findings.length})</Text><Button component="a" href="#/exceptions" variant="light" size="xs">Open exception queue</Button></Group>
          <Table.ScrollContainer minWidth={650}><Table><Table.Thead><Table.Tr><Table.Th>Issue</Table.Th><Table.Th>Reference</Table.Th><Table.Th>Difference</Table.Th><Table.Th>Severity</Table.Th><Table.Th>Investigation</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{run.findings.map((finding) => {
            const item = state.cases.find((candidate) => candidate.key === finding.key);
            return <Table.Tr key={finding.key}><Table.Td><Text size="xs" fw={500}>{finding.type}</Text><Text size="11px" c="dimmed" maw={420}>{finding.message}</Text></Table.Td><Table.Td>{finding.entity}</Table.Td><Table.Td>{formatMoney(finding.amountCents)}</Table.Td><Table.Td><Status value={finding.severity} /></Table.Td><Table.Td>{item && <Button component="a" href={`#/${caseHref(item)}`} variant="subtle" size="compact-xs" aria-label={`Investigate ${item.displayId}`}>{item.displayId}</Button>}</Table.Td></Table.Tr>;
          })}</Table.Tbody></Table></Table.ScrollContainer></>}
        <Text className={styles.footnote}>Rule version {run.ruleVersion} · Values are checked in integer cents. Findings may overlap; their amounts are not summed.</Text>
      </>}
    </Panel>
    <Modal opened={!!sourceView} onClose={() => setSourceView(null)} title={sourceView ? FEEDS[sourceView].label : ''} size="xl">
      {selectedSource && <Stack><Text size="xs" c="dimmed">{selectedSource.filename} · {selectedSource.fingerprint} · Actual import: {timestamp(selectedSource.importedAt)}</Text>{selectedValidation?.errors.map((error, index) => <Text c="red" size="xs" key={index}>{error}</Text>)}<Button variant="light" leftSection={<Download size={15} />} onClick={() => downloadFile(selectedSource)}>Download source CSV</Button><pre className={styles.record}>{selectedSource.text}</pre></Stack>}
    </Modal>
  </>;
}
