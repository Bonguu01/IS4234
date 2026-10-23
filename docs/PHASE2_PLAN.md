# Phase 2 — daily delivery monitoring

Implement only the prioritised Phase 2 scope in ROADMAP.md. Separate heartbeats, pending-transaction grace periods, financial risk aggregation and management intervention remain excluded.

## Rules

- Monitoring starts explicitly for one business date and the existing bank/partner/FBO scope. Capture valid bank balances, customer opening records and bank transactions as an independent monitoring snapshot. Preserve the manual upload workspace.
- Expect two intermediary CSV sources: transactions and closing customer balances. The deadline is five simulated minutes after the window starts. This is a demonstration delivery policy, not a settlement or regulatory deadline.
- Monitor availability every 15 actual seconds while open, on clock changes, after receipt/replay and on reopening. The existing simulated clock drives delivery and investigation deadlines; actual receipt/run/activity timestamps and reconciliation business dates stay separate.
- Before the deadline, an absent source is Awaiting delivery. At or after the deadline it is Overdue. A receipt processed at the exact deadline is considered before evaluation. Stale and invalid receipts fail immediately. Valid header-only transaction data is a received zero-activity source.
- Record expected date, due time, declared coverage, actual/simulated receipt time, filename, fingerprint and validation errors. Delivery status does not establish financial correctness.
- One critical delivery case per source, bank/partner/account and business date. Repeated evaluation or duplicate event IDs do not duplicate cases/activity. New failures can reopen a resolved case. Existing immediate critical escalation applies.
- When both sources are usable, automatically reconcile the complete snapshot with Phase 1's engine. Cache each accepted snapshot evaluation so periodic checks do not repeatedly append identical runs. A new delivery triggers a fresh applicable recheck.
- Delivery cases become eligible for resolution only when both current sources are valid and the automatic snapshot reconciliation is Passed. Invalid, partial, discrepant or blocked recovery cannot clear them. Manual-workspace runs cannot bypass this gate. Owner assignment and a resolution note remain mandatory; recovery never automatically closes cases.
- Stopping monitoring stops new delivery checks; existing cases and history remain. It does not freeze the shared clock or resolve investigations. Resume reevaluates elapsed deadlines. Each window is explicitly started; no implicit midnight rollover or closed-browser background service.

## Replay and interfaces

Provide on-time, missing/recovery, invalid/recovery, stale/recovery, zero-activity and delivered-but-discrepant demos. A Next replay event control advances simulated time only forward and supplies real synthetic CSV payloads to the importer; the engine calculates outcomes. Keep manual delivery upload and a Start from staged bank records action for custom tests. Starting a new window replaces only the active monitoring snapshot and retains investigations, runs and history.

Dashboard summarises delivery health separately from reconciliation health. Reconciliation uses Manual CSV records and Delivery monitoring tabs to prevent confusing separate inputs, with shared historical results below. Exceptions distinguish delivery cases and explain recovery requirements. No new top-level screen or component library.

## Persistence and acceptance

Use state version 2 with monitoring state. Retain the existing localStorage key; validate and migrate version-1 saved work by adding inactive monitoring defaults, preserving datasets, clock, cases and events. Validate monitoring snapshots and recovery references on load. Show failures without silently overwriting damaged saved data.

Tests cover deadline boundaries, quiet days, stale/invalid files, duplicate events/evaluations, partial/failed recovery, successful recovery, reopening, stop/resume, reload and migration, clock isolation, upload races/failures, dashboard distinctions and all earlier Phase 1 regressions. Build and verify the static application; do not deploy or implement Phase 3.
