import { Badge, Button, Group, Paper, Text } from '@mantine/core';
import { ArrowUpRight, CircleCheck, CircleAlert, ShieldCheck } from 'lucide-react';
import styles from './App.module.css';

const colors = { Clear: 'ledger', Review: 'orange', Unknown: 'gray', Passed: 'ledger', Ready: 'ledger', Resolved: 'gray', Exceptions: 'orange', Blocked: 'red', Missing: 'red', Invalid: 'red', Stale: 'orange', Open: 'ledger', Investigating: 'blue', Escalated: 'violet', Critical: 'red', High: 'orange', Received: 'ledger', Overdue: 'red', 'Delivery complete': 'ledger', 'Needs attention': 'red', 'Awaiting records': 'blue' };
export function Status({ value, color }) { return <Badge color={color ?? colors[value] ?? 'gray'}>{value}</Badge>; }
export function Panel({ title, action, children, ...props }) {
  return <Paper className={styles.panel} {...props}>{title && <div className={styles.panelHeading}><h2 className={styles.panelTitle}>{title}</h2>{action}</div>}{children}</Paper>;
}
export function Heading({ eyebrow, title, description, action }) {
  return <div className={styles.heading}><div><div className={styles.eyebrow}>{eyebrow}</div><h1 className={styles.title}>{title}</h1><div className={styles.subtitle}>{description}</div></div>{action}</div>;
}
export function Metric({ label, value, detail, icon: Icon = ShieldCheck, tone = 'neutral' }) {
  return <Paper className={styles.metric} data-tone={tone}><div className={styles.metricTop}><span className={styles.metricIcon}><Icon size={20} strokeWidth={1.8} /></span><div><div className={styles.metricLabel}>{label}</div><div className={styles.metricValue}>{value}</div></div></div><div className={styles.metricDetail}>{detail}</div></Paper>;
}
export function Empty({ title, description, action }) {
  return <div className={styles.empty}><ShieldCheck className={styles.emptyIcon} size={32} strokeWidth={1.4} /><Text fw={600} c="#17233A" mb={7}>{title}</Text><Text size="sm" c="dimmed" mb={18}>{description}</Text>{action}</div>;
}
export function NavigateButton({ href, children, ...props }) { return <Button component="a" href={`#/${href}`} variant="subtle" size="xs" rightSection={<ArrowUpRight size={14} />} {...props}>{children}</Button>; }
export function Outcome({ status }) {
  const Icon = status === 'Passed' ? CircleCheck : CircleAlert;
  return <Group gap="xs"><Icon size={19} color={status === 'Passed' ? '#16866A' : status === 'Blocked' ? '#c43d4b' : '#b87913'} /><Status value={status} /></Group>;
}
export function timestamp(value) { return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC' : '—'; }
export function Activity({ events, limit = 8 }) {
  if (!events.length) return <Text size="sm" c="dimmed">No activity recorded for this view yet.</Text>;
  return [...events].reverse().slice(0, limit).map((event) => <div className={styles.activity} key={event.id}><Group align="flex-start" wrap="nowrap" gap="sm"><span className={styles.eventDot} data-type={event.type} /><div style={{ minWidth: 0, flex: 1 }}><Text size="xs" fw={550}>{event.message}</Text><Text size="11px" c="dimmed" mt={4}>{event.actor} · Actual: {timestamp(event.systemAt)}</Text>{event.businessAt !== event.systemAt && <Text size="11px" c="dimmed">Deadline clock: {timestamp(event.businessAt)}</Text>}</div></Group></div>);
}
