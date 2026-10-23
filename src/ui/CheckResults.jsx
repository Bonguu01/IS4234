import { Accordion, ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { CircleAlert, CircleCheck, Info, LockKeyhole } from 'lucide-react';
import { formatMoney } from '../domain/money';
import { Status } from './shared';
import styles from './App.module.css';

const explanations = {
  opening: 'Customer starting balances must add up to the bank’s opening total.',
  bank_movement: 'The bank’s opening balance plus posted movements must explain its closing balance.',
  aggregate: 'The intermediary’s customer closing balances must add up to the pooled bank balance.',
  transactions: 'Compare each transaction reference, customer and amount across both sources.',
  customers: 'Rebuild each customer’s closing balance using the bank’s recorded movements.',
  ledger: 'Check whether the intermediary’s own movements explain its customer closing balances.',
};

export default function CheckResults({ checks }) {
  const groups = [
    { title: 'Source readiness', description: 'All five sources must be present, valid and cover the selected date.', items: checks.filter((check) => check.id.startsWith('feed:')) },
    { title: 'Financial agreement', description: 'A matching total alone cannot establish correct customer allocations.', items: checks.filter((check) => !check.id.startsWith('feed:')) },
  ];
  const rows = (items) => [...items].sort((a, b) => Number(a.status === 'Passed') - Number(b.status === 'Passed')).map((check) => {
    const Icon = check.status === 'Passed' ? CircleCheck : check.status === 'Blocked' ? LockKeyhole : CircleAlert;
    return <div className={styles.check} key={check.id} data-outcome={check.status}>
      <Icon size={17} className={styles.checkIcon} aria-hidden="true" />
      <div className={styles.checkContent}><Group gap={5} wrap="nowrap"><Text size="sm" fw={550} tt={check.id.startsWith('feed:') ? 'capitalize' : undefined}>{check.label}</Text>
        {explanations[check.id] && <Tooltip label={explanations[check.id]} multiline w={260} withArrow events={{ hover: true, focus: true, touch: true }}><ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Explain ${check.label}`}><Info size={14} /></ActionIcon></Tooltip>}
      </Group>
        {check.detail?.differenceCents !== undefined && <Text size="xs" mt={5}>Difference: <strong>{formatMoney(check.detail.differenceCents)}</strong>{check.status !== 'Passed' && <> · Expected {formatMoney(check.detail.expectedCents)} · Observed {formatMoney(check.detail.actualCents)}</>}</Text>}
        {typeof check.detail === 'string' && <Text size="xs" c="dimmed" mt={4}>{check.detail}</Text>}
      </div><Status value={check.status} />
    </div>;
  });
  return groups.map(({ title, description, items }) => <section key={title} className={styles.checkGroup} aria-label={title}>
    <Group justify="space-between" gap="xs" mb={5}><Text size="sm" fw={650}>{title}</Text><Text size="xs" c="dimmed">{items.filter((item) => item.status === 'Passed').length} / {items.length} passed</Text></Group>
    <Text size="xs" c="dimmed" mb="xs">{description}</Text>
    {title === 'Source readiness' ? <Accordion key={String(items.some((check) => check.status === 'Blocked'))} className={styles.quietDisclosure} defaultValue={items.some((check) => check.status === 'Blocked') ? 'sources' : null}><Accordion.Item value="sources"><Accordion.Control>Source checks</Accordion.Control><Accordion.Panel>{rows(items)}</Accordion.Panel></Accordion.Item></Accordion> : rows(items)}
  </section>);
}
