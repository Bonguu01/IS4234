import { useEffect, useRef, useState } from 'react';
import { Accordion, Alert, Button, Divider, Drawer, Group, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { Circle, CircleCheck, Clock3, Flag, Search, ShieldAlert, UserCheck } from 'lucide-react';
import { useAppState } from '../state/AppState';
import { STAFF, businessNow } from '../domain/workflow';
import { formatMoney } from '../domain/money';
import { caseCheckLabel, caseDeadline, matchesQueueView } from '../domain/case-display';
import { caseHref, relatedCases, runHref, RISK_POLICY } from '../domain/risk';
import { Activity, Empty, Heading, Metric, NavigateButton, Panel, Status, timestamp } from '../ui/shared';
import EvidenceRecords from '../ui/EvidenceRecords';
import QueueFilters from '../ui/QueueFilters';
import styles from '../ui/App.module.css';

function CaseDetail({ item, now }) {
  const { state, actions, error } = useAppState();
  const detailRef = useRef(null);
  useEffect(() => { detailRef.current?.closest('[role="dialog"]')?.scrollTo?.({ top: 0, behavior: 'instant' }); }, []);
  const [note, setNote] = useState(''); const [reason, setReason] = useState(''); const [feedback, setFeedback] = useState('');
  const supportingRun = state.runs.find((run) => run.id === item.latestRunId);
  const verificationRun = state.runs.find((run) => run.id === item.verificationRunId);
  const related = relatedCases(state, item);
  const deadline = caseDeadline(item, now);
  const act = (action) => {
    const ok = actions.caseAction(item.id, action);
    if (ok) { setFeedback('Action saved.'); if (action.type === 'note') setNote(''); }
  };
  return <Stack gap="lg" ref={detailRef}>
    {error && <Alert color="red" title="Workspace notice">{error}</Alert>}
    <Group><Status value={item.status} /><Status value={item.severity} />{item.escalatedAt && <Status value="Escalated" />}{deadline.overdue && <Status value="Overdue" color="orange" />}</Group>
    <div><Text fw={600}>{item.type}</Text><Text size="xs" c="dimmed" mt={4}>{item.kind === 'delivery' ? 'Delivery monitoring · source availability' : 'Financial record reconciliation'}</Text><Text size="sm" c="dimmed" mt={5}>{item.message}</Text></div>
    {(supportingRun || verificationRun) && <Group gap="xs">{!item.verifiedClear && supportingRun && <NavigateButton href={runHref(supportingRun)}>View supporting run</NavigateButton>}{item.verifiedClear && verificationRun && <NavigateButton href={runHref(verificationRun)}>View verified correction</NavigateButton>}</Group>}
    <Group justify="space-between"><div><Text size="xs" c="dimmed">Reference</Text><Text size="sm">{item.entity}</Text></div><div><Text size="xs" c="dimmed">Difference</Text><Text size="sm" fw={600}>{formatMoney(item.amountCents)}</Text></div><div><Text size="xs" c="dimmed">Business date</Text><Text size="sm">{item.businessDate}</Text></div></Group>
    <Select label="Assigned owner" placeholder="Select responsible staff" data={STAFF} value={item.owner || null} onChange={(owner) => act({ type: 'assign', owner })} allowDeselect={false} />
    <Group><Button variant="light" size="xs" disabled={item.status !== 'Open' || !item.owner} onClick={() => act({ type: 'status', status: 'Investigating' })}>Start investigation</Button><Text size="xs" c="dimmed">{item.owner ? 'Record investigation notes and supporting evidence below.' : 'An owner is required before investigation.'}</Text></Group>
    {caseCheckLabel(item) && <Text size="xs" c="dimmed">{caseCheckLabel(item)}</Text>}
    <div><Text size="sm" fw={600} c={deadline.overdue ? 'orange.8' : 'dimmed'}>{deadline.label}</Text><Text size="xs" c="dimmed" mt={4}>Investigation deadline: {timestamp(item.dueBusinessAt)} · Evaluated using the demo deadline clock</Text></div>
    <div><Textarea label="Investigation note" placeholder="Record the action taken and relevant evidence…" value={note} onChange={(event) => setNote(event.currentTarget.value)} minRows={3} /><Button variant="light" size="xs" mt="sm" disabled={!note.trim()} onClick={() => act({ type: 'note', text: note })}>Save note</Button></div>
    {item.notes.length > 0 && <div>{item.notes.map((entry, index) => <div className={styles.activity} key={index}><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{entry.text}</Text><Text size="10px" c="dimmed" mt={4}>{entry.actor} · Actual: {timestamp(entry.systemAt)}</Text></div>)}</div>}
    <Divider />
    <Alert color={item.verifiedClear ? 'ledger' : 'orange'} title={item.verifiedClear ? 'Correction verified by recheck' : 'Correction not yet verified'}>{item.verifiedClear ? 'The latest applicable completed check no longer detects this finding. An owner and resolution note are still required.' : item.kind === 'delivery' ? 'Restore both valid intermediary deliveries in the delivery monitor. Its automatic snapshot reconciliation must be Passed before resolution. A manual-workspace run cannot clear this delivery case.' : 'Correct the source records, then run reconciliation for this scope and business date. A blocked check cannot clear this finding.'}</Alert>
    {item.status !== 'Resolved' && <div className={styles.resolutionChecklist} aria-label="Resolution requirements">
      <Text size="xs" fw={650} mb={3}>Required before closure</Text>
      {[[!!item.owner, 'Responsible owner assigned'], [!!item.verifiedClear, 'Correction verified by applicable recheck'], [!!reason.trim(), 'Resolution reason documented']].map(([done, label]) => {
        const Icon = done ? CircleCheck : Circle;
        return <div key={label}><Icon size={15} color={done ? '#16866a' : '#849083'} aria-hidden="true" /><span>{label} · {done ? 'Ready' : 'Required'}</span></div>;
      })}
    </div>}
    {item.status !== 'Resolved' && <><Textarea label="Escalation or resolution reason" placeholder="Explain the escalation or the verified correction…" value={reason} onChange={(event) => setReason(event.currentTarget.value)} minRows={2} /><Group><Button variant="light" color="violet" size="xs" disabled={!!item.escalatedAt || !reason.trim()} onClick={() => act({ type: 'escalate', reason })}>Escalate to compliance</Button><Button size="xs" disabled={!item.verifiedClear || !item.owner || !reason.trim()} onClick={() => act({ type: 'status', status: 'Resolved', reason })}>Resolve exception</Button></Group></>}
    {item.status === 'Resolved' && item.resolution && <Text size="sm">Resolution: {item.resolution.note}<br /><Text component="span" size="xs" c="dimmed">Actual: {timestamp(item.resolution.systemAt)}</Text></Text>}
    {feedback && <Text role="status" size="xs" c="ledger">{feedback}</Text>}
    <Accordion multiple variant="separated">
    <Accordion.Item value="details"><Accordion.Control>Case details & referral reason</Accordion.Control><Accordion.Panel><Text size="xs" c="dimmed">{item.scope.bank_id} / {item.scope.partner_id} / {item.scope.fbo_account_id}<br />Actually detected: {timestamp(item.firstDetectedAt)}</Text>{item.escalatedAt && <Text size="xs" mt="sm">Risk / Compliance referral: {item.escalationReason}<br />Actual event: {timestamp(item.escalatedAt)}</Text>}</Accordion.Panel></Accordion.Item>
    {related.length > 0 && <Accordion.Item value="related"><Accordion.Control>Related investigations ({related.length})</Accordion.Control><Accordion.Panel><Text size="xs" c="dimmed" mb="sm">Links identify shared evidence or snapshot context, not a proven common cause.</Text><Stack gap="xs">{related.map((link) => <a className={styles.relatedLink} href={`#/${caseHref(link.item)}`} key={link.item.id}><Text size="xs" fw={600}>{link.item.displayId} · {link.item.type}</Text><Text size="xs" c="dimmed" mt={4}>{link.reason}</Text></a>)}</Stack></Accordion.Panel></Accordion.Item>}
    <Accordion.Item value="evidence"><Accordion.Control>Source evidence at last detection ({item.evidence.length})</Accordion.Control><Accordion.Panel>
    <Text size="xs" c="dimmed">Evidence retains the detected records. Successful correction evidence is available in the verification run.</Text>
    {item.evidence.length ? <Stack gap="sm" mt="sm"><EvidenceRecords evidence={item.evidence} /></Stack> : <Text size="xs" c="dimmed">This is a source availability issue. Open the supporting run’s validation results.</Text>}
    </Accordion.Panel></Accordion.Item>
    <Accordion.Item value="history"><Accordion.Control>Evidence & activity history</Accordion.Control><Accordion.Panel>
    <Activity events={state.events.filter((event) => event.caseId === item.id)} limit={Number.MAX_SAFE_INTEGER} />
    </Accordion.Panel></Accordion.Item></Accordion>
  </Stack>;
}

export default function Exceptions({ requestedCaseId = null }) {
  const { state } = useAppState();
  const [, refreshClock] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => refreshClock((tick) => tick + 1), 15000); return () => window.clearInterval(timer); }, []);
  const now = businessNow(state);
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('All'); const [priority, setPriority] = useState('All');
  const setSelected = (id) => { window.location.hash = `/exceptions${id ? `?case=${encodeURIComponent(id)}` : ''}`; };
  const cases = [...state.cases].reverse().filter((item) => matchesQueueView(item, status, now) && (priority === 'All' || item.severity === priority) && `${item.displayId} ${item.type} ${caseCheckLabel(item) ?? ''} ${item.entity} ${item.owner} ${item.businessDate}`.toLowerCase().includes(query.toLowerCase()));
  const unresolved = state.cases.filter((item) => item.status !== 'Resolved');
  const selectedCase = state.cases.find((item) => item.id === requestedCaseId);
  return <>
    <Heading eyebrow="Investigation workspace" title="Exceptions" description="Assign responsibility. Investigate. Verify recovery." />
    {requestedCaseId && !selectedCase && <Alert color="orange" mb="lg" title="Case unavailable">This case is not in the current workspace. Choose an investigation below.</Alert>}
    <div className={styles.metrics}><Metric label="Unresolved exceptions" value={unresolved.length} detail="Open and investigating cases" icon={ShieldAlert} /><Metric label="Assigned for review" value={unresolved.filter((item) => item.owner).length} detail="Unresolved cases with an owner" icon={UserCheck} /><Metric label="Escalated" value={unresolved.filter((item) => item.escalatedAt).length} detail="Referred to Risk / Compliance" icon={Flag} /><Metric label="Overdue cases" value={unresolved.filter((item) => caseDeadline(item, now).overdue).length} detail="Evaluated using the deadline clock" icon={Clock3} /></div>
    <Panel title={`Exception queue (${cases.length})`} action={<QueueFilters priority={priority} status={status} onPriority={setPriority} onStatus={setStatus} />}>
      <TextInput aria-label="Search exceptions" placeholder="Search exceptions, customer or transaction references, owners…" leftSection={<Search size={15} />} value={query} onChange={(event) => setQuery(event.currentTarget.value)} size="sm" mb="lg" maw={580} />
      {(query || priority !== 'All' || status !== 'All') && <Button variant="subtle" size="compact-xs" mb="sm" onClick={() => { setQuery(''); setPriority('All'); setStatus('All'); }}>Clear search and filters</Button>}
      {(priority !== 'All' || status !== 'All') && <Text size="xs" c="dimmed" mb="md" aria-live="polite">Active filters: {[priority !== 'All' ? `${priority} priority` : null, status !== 'All' ? status : null].filter(Boolean).join(' · ')}</Text>}
      {!cases.length ? <Empty title={state.cases.length ? 'No cases match these filters' : 'No exceptions detected yet'} description={state.cases.length ? 'Adjust your search or filters to find a case.' : 'Run reconciliation to generate cases from actual source records.'} /> : <>
        <div className={styles.caseCards}>{cases.map((item) => <article className={styles.caseCard} key={item.id} aria-label={`Investigation ${item.displayId}`}>
          <Group justify="space-between" mb="xs"><Text size="xs" fw={650}>{item.displayId}</Text><Status value={item.severity} /></Group>
          <Text size="sm" fw={600}>{item.type}</Text>{caseCheckLabel(item) && <Text size="xs" c="dimmed" mt={4}>{caseCheckLabel(item)}</Text>}<Text size="xs" c="dimmed" mt={5}>{item.entity} · {item.businessDate}</Text>
          <Group gap="xs" mt="sm"><Status value={item.status} />{item.escalatedAt && item.status !== 'Resolved' && <Status value="Escalated" />}{caseDeadline(item, now).overdue && <Status value="Overdue" color="orange" />}</Group>
          {item.verifiedClear && item.status !== 'Resolved' && <Text size="xs" c="ledger" mt={5}>Correction verified</Text>}
          <Group justify="space-between" mt="md"><div><Text size="xs" c="dimmed">Difference</Text><Text size="sm" fw={600}>{formatMoney(item.amountCents)}</Text></div><div><Text size="xs" c="dimmed">Owner</Text><Text size="xs">{item.owner || 'Unassigned'}</Text></div></Group>
          <Button variant="light" size="xs" fullWidth mt="md" onClick={() => setSelected(item.id)} aria-label={`View ${item.displayId}`}>View investigation</Button>
        </article>)}</div>
        <div className={styles.caseTable}><Table.ScrollContainer minWidth={930}><Table><Table.Thead><Table.Tr><Table.Th>Exception ID</Table.Th><Table.Th>Issue type</Table.Th><Table.Th>Business date</Table.Th><Table.Th>Difference</Table.Th><Table.Th>Priority</Table.Th><Table.Th>Status</Table.Th><Table.Th>Assigned to</Table.Th><Table.Th>Action</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{cases.map((item) => <Table.Tr key={item.id}><Table.Td><Text size="xs" fw={550}>{item.displayId}</Text><Text size="10px" c="dimmed" mt={3}>{item.entity}</Text></Table.Td><Table.Td>{item.type}{caseCheckLabel(item) && <Text size="10px" c="dimmed" mt={4}>{caseCheckLabel(item)}</Text>}</Table.Td><Table.Td>{item.businessDate}</Table.Td><Table.Td style={{ whiteSpace: 'nowrap' }}>{formatMoney(item.amountCents)}</Table.Td><Table.Td><Status value={item.severity} /></Table.Td><Table.Td><Stack gap={4} align="flex-start"><Status value={item.status} />{item.escalatedAt && item.status !== 'Resolved' && <Status value="Escalated" />}{caseDeadline(item, now).overdue && <Status value="Overdue" color="orange" />}{item.verifiedClear && item.status !== 'Resolved' && <Text size="10px" c="ledger">Correction verified</Text>}</Stack></Table.Td><Table.Td>{item.owner || 'Unassigned'}</Table.Td><Table.Td><Button variant="outline" size="compact-xs" onClick={() => setSelected(item.id)} aria-label={`View ${item.displayId}`}>View</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></div>
      </>}
      <Text className={styles.footnote}>Difference is signed: observed minus expected where applicable. Amounts from overlapping checks are not a cumulative loss estimate.</Text>
    </Panel>
    <Accordion variant="separated" mb="lg"><Accordion.Item value="policy"><Accordion.Control>Escalation policy</Accordion.Control><Accordion.Panel><Text size="sm" lh={1.8}>Overdue means an unresolved case has reached its deadline. Escalated means it has been referred to Risk / Compliance; referral can happen before a deadline. Resolving a case removes its active Overdue badge and preserves its history. Critical source failures escalate immediately. Other cases escalate after 24 deadline-clock hours. Current financial cases are referred when the absolute gap reaches {formatMoney(RISK_POLICY.reviewGapCents)} or transaction allocations disagree. Analysts can also refer a case with a reason. All referrals are recorded locally; no emails or banking actions are sent.</Text></Accordion.Panel></Accordion.Item></Accordion>
    <Drawer opened={!!selectedCase} onClose={() => setSelected(null)} title={selectedCase ? `${selectedCase.displayId} · Investigation` : ''} position="right" size="lg">{selectedCase && <CaseDetail key={selectedCase.id} item={selectedCase} now={now} />}</Drawer>
  </>;
}
