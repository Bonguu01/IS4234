import { useState } from 'react';
import { Accordion, Button, FileInput, Group, Select, Text, TextInput } from '@mantine/core';
import { FileSpreadsheet } from 'lucide-react';
import { DATE_FORMATS, FEEDS, feedIds } from '../domain/imports';
import { useAppState } from '../state/AppState';
import { Status } from './shared';
import styles from './App.module.css';

export default function SourceRecords({ validation, onInspect }) {
  const { state, actions } = useAppState();
  const [opened, setOpened] = useState(null);
  const [formats, setFormats] = useState({});
  return <>
    <Text size="xs" c="dimmed" mb="sm">Select a source to upload, inspect or change its coverage.</Text>
    <Accordion variant="separated" value={opened} onChange={setOpened} className={styles.sourceList}>
      {feedIds.map((id) => {
        const source = state.dataset.feeds[id]; const result = validation[id];
        const dateFormat = source?.dateFormat ?? formats[id] ?? 'iso';
        return <Accordion.Item key={id} value={id}>
          <Accordion.Control aria-label={`${FEEDS[id].label} source controls`} aria-describedby={`source-${id}-summary${source && result.errors.length ? ` source-${id}-error` : ''}`}>
            <div className={styles.sourceSummary} id={`source-${id}-summary`}><div className={styles.sourceIdentity}>
              <Text component="span" size="sm" fw={600} display="block">{FEEDS[id].label}</Text>
              <Text component="span" size="xs" c="dimmed" display="block" truncate>{source ? `${source.coverageDate || 'No coverage date'} · ${result.rows.length} ${result.rows.length === 1 ? 'record' : 'records'} · ${source.filename}` : 'No file uploaded'}</Text>
            </div><Status value={result.status} /></div>
          </Accordion.Control>
          {source && result.errors.length > 0 && <Text id={`source-${id}-error`} className={styles.sourceError} size="xs" c={result.status === 'Stale' ? 'orange.8' : 'red.7'}>{result.errors[0]}{result.errors.length > 1 ? ` (+${result.errors.length - 1} more in Inspect)` : ''}</Text>}
          <Accordion.Panel>
            <Select label="CSV date format" aria-label={`${FEEDS[id].label} CSV date format`} description="Choose how business_date is written inside this file. Dates are normalised to YYYY-MM-DD." data={DATE_FORMATS} value={dateFormat} allowDeselect={false} onChange={(value) => { setFormats((current) => ({ ...current, [id]: value })); actions.setDateFormat(id, value); }} size="xs" mb="sm" />
            <FileInput label={`Upload ${FEEDS[id].label.toLowerCase()}`} value={null} placeholder={source?.filename ?? 'Choose CSV file'} accept=".csv,text/csv" leftSection={<FileSpreadsheet size={15} />} onChange={(file) => actions.upload(id, file, dateFormat)} size="xs" />
            <Group align="flex-end" mt="sm" gap="xs"><TextInput label="Declared coverage date" aria-label={`${FEEDS[id].label} coverage date`} type="date" value={source?.coverageDate ?? ''} disabled={!source} onChange={(event) => actions.setCoverage(id, event.currentTarget.value)} size="xs" style={{ flex: 1, minWidth: 150 }} />
              <Button variant="subtle" size="compact-xs" disabled={!source} onClick={() => onInspect(id)}>Inspect</Button>
              <Button variant="subtle" color="gray" size="compact-xs" disabled={!source} onClick={() => actions.removeFeed(id)}>Remove</Button>
            </Group>
          </Accordion.Panel>
        </Accordion.Item>;
      })}
    </Accordion>
  </>;
}
