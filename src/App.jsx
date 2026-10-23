import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { AlertTriangle, BarChart3, BookOpen, Clock3, LayoutDashboard, RotateCcw, Scale, ShieldAlert } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Reconciliation from './pages/Reconciliation';
import Exceptions from './pages/Exceptions';
import { useAppState } from './state/AppState';
import { businessNow } from './domain/workflow';
import { timestamp } from './ui/shared';
import styles from './ui/App.module.css';
import DemoGuide from './ui/DemoGuide';

const navigation = [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'reconciliation', label: 'Reconciliation', icon: Scale }, { id: 'exceptions', label: 'Exceptions', icon: ShieldAlert }];
function route() {
  const [path, query] = window.location.hash.split('?');
  const mode = new URLSearchParams(query).get('mode');
  const params = new URLSearchParams(query);
  return { page: navigation.find((item) => `#/${item.id}` === path)?.id ?? 'dashboard', mode: ['manual', 'monitoring'].includes(mode) ? mode : null, runId: params.get('run'), caseId: params.get('case') };
}

export default function App() {
  const { state, actions, error } = useAppState();
  const [location, setLocation] = useState(route); const { page } = location;
  const [clockOpen, setClockOpen] = useState(false); const [resetOpen, setResetOpen] = useState(false); const [, setTick] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    const change = () => { const next = route(); setLocation((previous) => { if (next.page !== previous.page) window.scrollTo?.(0, 0); return next; }); };
    window.addEventListener('hashchange', change);
    const interval = setInterval(() => setTick((value) => value + 1), 15000);
    return () => { window.removeEventListener('hashchange', change); clearInterval(interval); };
  }, []);
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><BarChart3 size={31} strokeWidth={3} className={styles.brandIcon} />LedgerWatch</div>
      <nav className={styles.nav} aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <a key={id} href={`#/${id}`} className={`${styles.navLink} ${page === id ? styles.active : ''}`} aria-current={page === id ? 'page' : undefined}><Icon size={19} strokeWidth={1.7} />{label}</a>)}</nav>
      <div className={styles.sidebarBottom}><Badge color="ledger" mb="sm">Synthetic demonstration</Badge><Text size="11px" c="dimmed" lh={1.8}>Independent records.<br />Accountable investigations.</Text><Button variant="subtle" color="gray" size="compact-xs" mt="xl" leftSection={<RotateCcw size={12} />} onClick={() => setResetOpen(true)}>Reset workspace</Button></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><div><Text size="xs" fw={600}>Northstar Bank <Text component="span" c="dimmed" fw={400}>/ Bridgeway Technologies</Text></Text><Text className={styles.topbarText} mt={5}>FBO-001 · USD · Browser-local workspace</Text></div><Group gap="sm"><Button variant="light" size="xs" leftSection={<BookOpen size={14} />} onClick={() => setGuideOpen(true)}>Demo guide</Button><Button variant="default" size="xs" leftSection={<Clock3 size={14} />} onClick={() => setClockOpen(true)}>Demo deadline clock</Button><Button className={styles.mobileReset} variant="subtle" color="gray" size="compact-xs" leftSection={<RotateCcw size={12} />} onClick={() => setResetOpen(true)}>Reset workspace</Button></Group></header>
      <main className={styles.main}>
        {error && <Alert role="alert" color="red" icon={<AlertTriangle size={17} />} title="Workspace notice" mb="lg" withCloseButton onClose={actions.dismissError}>{error}</Alert>}
        {page === 'dashboard' && <Dashboard />}{page === 'reconciliation' && <Reconciliation requestedMode={location.mode} requestedRunId={location.runId} />}{page === 'exceptions' && <Exceptions requestedCaseId={location.caseId} />}
      </main>
    </div>
    <DemoGuide opened={guideOpen} onClose={() => setGuideOpen(false)} />
    <Modal opened={clockOpen} onClose={() => setClockOpen(false)} title="Demo deadline clock" size="lg">
      <Stack><Alert color="ledger">This clock demonstrates investigation deadlines, daily delivery deadlines and overdue escalation. Advancing it can make an expected delivery overdue. It does not change reconciliation dates, declared source coverage, imported records or actual event timestamps.</Alert><div><Text size="xs" c="dimmed">Actual system time</Text><Text size="sm" mt={4}>{timestamp(new Date().toISOString())}</Text></div><div><Text size="xs" c="dimmed">Simulated deadline time</Text><Text size="sm" fw={600} mt={4} data-testid="business-clock">{timestamp(businessNow(state))}</Text></div><Group><Button variant="light" onClick={() => actions.advance(1)}>Advance 1 hour</Button><Button onClick={() => actions.advance(25)}>Advance 25 hours</Button></Group><Text size="xs" c="dimmed">Clock changes and escalation events are saved with their actual timestamps. Deadline time continues to elapse normally between advances. Resetting the workspace clears all records and resets this clock.</Text></Stack>
    </Modal>
    <Modal opened={resetOpen} onClose={() => setResetOpen(false)} title="Reset local workspace?" centered><Text size="sm" mb="lg">This clears this browser’s datasets, reconciliation runs, investigations and history. The deadline clock also resets. This cannot be undone.</Text><Group justify="flex-end"><Button variant="default" onClick={() => setResetOpen(false)}>Cancel</Button><Button color="red" onClick={() => { actions.reset(); setResetOpen(false); }}>Clear workspace</Button></Group></Modal>
  </div>;
}
