import { Accordion, Text } from '@mantine/core';
import { FEEDS } from '../domain/imports';
import { timestamp } from './shared';
import styles from './App.module.css';

const fields = [
  ['business_date', 'Business date'], ['customer_id', 'Customer'], ['transaction_ref', 'Transaction'],
  ['opening_balance', 'Opening balance'], ['amount', 'Movement'], ['closing_balance', 'Closing balance'],
  ['expectedBusinessDate', 'Expected business date'], ['coverageDate', 'Received coverage'], ['status', 'Delivery status'], ['filename', 'Received file'],
];

export default function EvidenceRecords({ evidence }) {
  return evidence.map((entry, index) => <section className={styles.demoCard} key={index}>
    <Text size="xs" fw={650}>{FEEDS[entry.feed]?.label ?? entry.feed}{entry.rowNumber !== null ? ` · CSV row ${entry.rowNumber}` : ' · Source-level evidence'}</Text>
    <div className={styles.evidenceFields}>{fields.filter(([key]) => entry.record?.[key] !== undefined && entry.record?.[key] !== null).map(([key, label]) => <div key={key}><Text size="xs" c="dimmed">{label}</Text><Text size="sm" fw={500}>{entry.record[key]}</Text></div>)}</div>
    {entry.record?.actualReceivedAt && <Text size="xs" c="dimmed">Actual receipt: {timestamp(entry.record.actualReceivedAt)}</Text>}
    {entry.record?.errors?.length > 0 && <Text size="xs" c="red.7" mt="xs">{entry.record.errors[0]}</Text>}
    <Accordion className={styles.quietDisclosure}><Accordion.Item value="raw"><Accordion.Control>Technical record</Accordion.Control><Accordion.Panel><pre className={styles.record}>{JSON.stringify(entry.record, null, 2)}</pre></Accordion.Panel></Accordion.Item></Accordion>
  </section>);
}
