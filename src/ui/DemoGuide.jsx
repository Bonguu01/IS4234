import { Accordion, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useAppState } from '../state/AppState';
import { SCENARIOS } from '../data/scenarios';
import styles from './App.module.css';

export const DEMO_TALKING_POINTS = {
  matching: 'Establish the baseline: the bank and intermediary records agree.',
  difference: 'The intermediary overstates a deposit by $400. Several checks find it; the position is counted once.',
  corrected: 'Corrected records remove the gap. Investigations still need an owner and a documented resolution.',
  allocation: 'The total matches, but a transaction belongs to the wrong customer. Totals alone are insufficient.',
  missing: 'The closing ledger is missing. The bank cannot verify the financial position.',
  stale: 'Yesterday’s ledger cannot verify today’s selected business date.',
};
const expected = { matching: 'Passed', difference: 'Exceptions', corrected: 'Passed', allocation: 'Exceptions', missing: 'Blocked', stale: 'Blocked' };

export default function DemoGuide({ opened, onClose }) {
  const { actions } = useAppState();
  const load = (id) => {
    if (actions.loadSample(id)) { window.location.hash = '/reconciliation?mode=manual'; onClose(); }
  };
  const card = (scenario) => <div className={styles.demoCard} key={scenario.id}>
    <Group justify="space-between" mb="xs"><Text size="sm" fw={650}>{scenario.label}</Text><Text size="xs" c="dimmed">Expected: {expected[scenario.id]}</Text></Group>
    <Text size="sm" c="dimmed" lh={1.6}>{DEMO_TALKING_POINTS[scenario.id]}</Text><Button variant="light" size="xs" mt="md" onClick={() => load(scenario.id)}>Load {scenario.id === 'difference' ? '$400 discrepancy' : scenario.id === 'corrected' ? 'corrected records' : scenario.id === 'matching' ? 'matching records' : scenario.id === 'allocation' ? 'allocation error' : scenario.id === 'missing' ? 'missing feed' : 'stale feed'}</Button>
  </div>;
  return <Modal opened={opened} onClose={onClose} title="LedgerWatch demo guide" size="lg">
    <Stack gap="lg">
      <div><Text fw={650} size="lg">Do the records agree—and who acts if they don’t?</Text><Text size="sm" c="dimmed" mt="xs" lh={1.7}>LedgerWatch compares a bank’s pooled account with its intermediary’s customer records. It flags differences and missing evidence, then tracks investigation and recovery.</Text></div>
      <Text size="sm"><strong>Suggested flow:</strong> Load a scenario → Run reconciliation → View Dashboard → Open an exception. Return with corrected records, recheck, then document closure.</Text>
      <div><Text size="sm" fw={600} mb="sm">A short demonstration</Text><div className={styles.demoCards}>{SCENARIOS.slice(0, 3).map(card)}</div></div>
      <Accordion variant="separated"><Accordion.Item value="more"><Accordion.Control>More scenarios</Accordion.Control><Accordion.Panel><div className={styles.demoCards}>{SCENARIOS.slice(3).map(card)}</div></Accordion.Panel></Accordion.Item>
        <Accordion.Item value="delivery"><Accordion.Control>Show a missed delivery</Accordion.Control><Accordion.Panel><Text size="sm" c="dimmed" lh={1.7}>Step through a transaction file arriving, the closing ledger missing its deadline, and recovery. No manual reconciliation is needed: usable deliveries trigger real checks automatically.</Text><Button size="xs" variant="light" mt="md" onClick={() => { if (actions.startReplay('outage')) { window.location.hash = '/reconciliation?mode=monitoring'; onClose(); } }}>Start missed-delivery demo</Button></Accordion.Panel></Accordion.Item>
      </Accordion>
      <Text size="xs" c="dimmed" lh={1.7}>Samples cover 20 October 2026. Loading retains cases and history; use Reset workspace before a fresh presentation if needed. The guide stages CSV data; outcomes are calculated from its contents. These are fictional proposed controls for the case study, not a reconstruction of Evolve’s systems or an explanation of Synapse’s bankruptcy.</Text>
    </Stack>
  </Modal>;
}
