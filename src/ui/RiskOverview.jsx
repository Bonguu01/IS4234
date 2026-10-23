import { Accordion, Group, Text } from '@mantine/core';
import { ArrowUpRight, Clock3, Flag, Scale, Users } from 'lucide-react';
import { useAppState } from '../state/AppState';
import { assessRisk, recommendations, RISK_POLICY } from '../domain/risk';
import { businessNow } from '../domain/workflow';
import { formatMoney } from '../domain/money';
import { Metric, Panel, Status } from './shared';
import styles from './App.module.css';

export default function RiskOverview() {
  const { state } = useAppState();
  const risk = assessRisk(state);
  const unresolved = state.cases.filter((item) => item.status !== 'Resolved');
  const overdue = unresolved.filter((item) => Date.parse(item.dueBusinessAt) <= Date.parse(businessNow(state)));
  const titles = { Unknown: 'Financial position not yet verified', High: 'Management review required', Review: 'Differences need review', Clear: 'Records agree' };
  return <>
    <Panel title="Current financial position" action={<Group gap="xs"><Text size="xs" c="dimmed">Assessment</Text><Status value={risk.category} /></Group>}>
      <div className={styles.riskHero} data-risk={risk.category}>
        <div><Text size="xl" fw={650}>{titles[risk.category]}</Text><Text size="sm" c="dimmed" mt={5}>{risk.reason}</Text></div>
        <Text size="xs" c="dimmed">{risk.businessDate} · {risk.origin === 'monitoring' ? 'Delivery monitoring' : 'Manual records'} · {risk.readyCount} / 5 sources ready</Text>
      </div>
      {risk.allocationCount > 0 && <Text size="sm" mt="md">{risk.allocationCount} transaction allocation mismatch{risk.allocationCount === 1 ? '' : 'es'}. Review the customer records even when the pooled total matches.</Text>}
      <Accordion variant="default" className={styles.quietDisclosure}>
        <Accordion.Item value="policy"><Accordion.Control>How is this assessed?</Accordion.Control><Accordion.Panel>
          <Text size="xs" c="dimmed" lh={1.8}>High: a balance gap of at least {formatMoney(RISK_POLICY.reviewGapCents)} in either direction, or a transaction allocated to different customers. Review: other financial differences. Clear: all checks passed. Unknown: required evidence or recheck is unavailable. These are demonstration policies.</Text>
          <Text size="xs" c="dimmed" mt="xs" lh={1.8}>The latest business date is used; repeat runs and overlapping findings are never added. A positive gap means the intermediary ledger exceeds the bank balance. Customer counts identify implicated records, not proven losses or harmed people. Open cases may include earlier dates.</Text>
          {risk.assessable && <Text size="xs" mt="xs">Bank closing balance: {formatMoney(risk.run.checks.find((check) => check.id === 'aggregate').detail.expectedCents)} · Intermediary closing total: {formatMoney(risk.run.checks.find((check) => check.id === 'aggregate').detail.actualCents)}</Text>}
          {risk.customers?.length > 0 && <Text size="xs" mt="xs">Customer references: {risk.customers.join(', ')}</Text>}
        </Accordion.Panel></Accordion.Item>
      </Accordion>
    </Panel>
    <div className={styles.metrics}>
      <Metric label="Current balance gap" value={risk.assessable ? formatMoney(risk.gapCents) : 'Not assessable'} detail={!risk.assessable ? 'Restore evidence or complete a recheck' : risk.gapCents > 0 ? 'Intermediary ledger exceeds bank balance' : risk.gapCents < 0 ? 'Bank balance exceeds intermediary ledger' : 'Pooled totals agree'} icon={Scale} tone={!risk.assessable ? 'Unknown' : risk.gapCents ? 'Exceptions' : 'neutral'} />
      <Metric label="Customer records flagged" value={risk.customers?.length ?? '—'} detail={risk.assessable ? 'Unique customers in detailed findings' : 'Awaiting usable financial evidence'} icon={Users} />
      <Metric label="Open cases" value={unresolved.length} detail={`All dates · ${unresolved.filter((item) => item.escalatedAt).length} referred to Risk / Compliance`} icon={Flag} tone={unresolved.length ? 'Exceptions' : 'neutral'} />
      <Metric label="Overdue actions" value={overdue.length} detail="Open cases past their deadline" icon={Clock3} tone={overdue.length ? 'Blocked' : 'neutral'} />
    </div>
    <Panel title="Next steps"><div className={styles.actionGrid}>{recommendations(state, risk).map((action) => <a className={styles.actionCard} href={`#/${action.href}`} key={action.title}>
      <div><Text size="sm" fw={600}>{action.title}</Text><Text size="xs" c="dimmed" mt={6}>{action.detail}</Text></div><ArrowUpRight size={17} aria-hidden="true" />
    </a>)}</div></Panel>
  </>;
}
