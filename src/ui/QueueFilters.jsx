import { useState } from 'react';
import { Button, Group, Popover, Select, Stack } from '@mantine/core';
import { SlidersHorizontal } from 'lucide-react';

export default function QueueFilters({ priority, status, onPriority, onStatus }) {
  const [opened, setOpened] = useState(false);
  const count = Number(priority !== 'All') + Number(status !== 'All');
  return <Popover opened={opened} onChange={setOpened} position="bottom-end" width={270} shadow="md" withinPortal trapFocus returnFocus>
    <Popover.Target><Button variant={count ? 'light' : 'default'} size="xs" leftSection={<SlidersHorizontal size={14} />} onClick={() => setOpened((value) => !value)} aria-expanded={opened} aria-haspopup="dialog">Filters{count ? ` (${count})` : ''}</Button></Popover.Target>
    <Popover.Dropdown aria-label="Exception filters"><Stack gap="md">
      <Select label="Priority" aria-label="Filter priority" size="sm" value={priority} onChange={onPriority} allowDeselect={false} comboboxProps={{ withinPortal: false }} data={[{ value: 'All', label: 'All priorities' }, 'Critical', 'High']} />
      <Select label="Queue view" aria-label="Filter status" size="sm" value={status} onChange={onStatus} allowDeselect={false} comboboxProps={{ withinPortal: false }} data={[{ value: 'All', label: 'All cases' }, 'Open', 'Investigating', 'Escalated', 'Overdue', 'Unassigned', 'Ready to close', 'Resolved']} />
      <Group justify="space-between"><Button variant="subtle" size="xs" disabled={!count} onClick={() => { onPriority('All'); onStatus('All'); }}>Clear filters</Button><Button size="xs" onClick={() => setOpened(false)}>Done</Button></Group>
    </Stack></Popover.Dropdown>
  </Popover>;
}
