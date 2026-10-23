# LedgerWatch development roadmap

## Final delivery goal

Phase 3 is the final planned release. Prioritise a complete, understandable analyst workflow over feature count: detect a problem, explain the evidence, assign responsibility, investigate, escalate, verify recovery and retain a reviewable history. Preserve the three-screen Mantine design and the Phase 1 controls.

All three phases are implemented. Phase 2 delivery rules are recorded in [PHASE2_PLAN.md](docs/PHASE2_PLAN.md); Phase 3's indicator, threshold and evidence policies are recorded in [PHASE3_PLAN.md](docs/PHASE3_PLAN.md). Phase 3 is the final planned release, ready for user review after verification.

## Phase 1 — Core MVP (implemented baseline)

- One fictional bank, intermediary and FBO account; USD synthetic daily records.
- Five-source sample bundles and manual CSV uploads.
- Strict validation; aggregate, transaction and customer reconciliation in integer cents.
- Missing/stale-source detection against a selected reconciliation date.
- Calculated findings, deduplicated cases, owners, notes, status transitions and evidence history.
- Immediate critical-source escalation and 24-hour unresolved-case deadlines, with separate real and demonstration clocks.
- Dashboard, Reconciliation and Exceptions screens using Mantine/CSS Modules.
- Browser-local persistence, automated domain/component/browser tests and a static production build.

**Boundary:** source availability is evaluated when data is inspected/reconciled. The deadline timer is not a heartbeat service or transaction monitoring engine. No authentication, backend, real APIs or fund movement.

## Phase 2 — Proactive monitoring (implemented)

Prioritise expected delivery of the intermediary's daily records:

- Track the expected business date and delivery deadline separately from actual receipt time.
- Detect overdue deliveries without requiring an employee to run reconciliation or any customer transaction to occur.
- Treat a valid zero-activity delivery as available evidence; distinguish missing delivery, stale coverage and invalid contents.
- Use a small deterministic scenario replay for on-time delivery, failed delivery and recovery. Replay supplies observations/data; it must not supply hardcoded outcomes.
- Generate deduplicated source-availability cases with understandable reasons, ownership, evidence and existing escalation controls.
- Require usable replacement evidence and an applicable successful reconciliation before resolving the related missing-feed investigation.

Reuse the domain check/finding interfaces and state repository; keep delivery observations separate from posted financial records. Preserve actual timestamps, reconciliation business dates and simulated deadline time. Keep manual uploads and existing sample scenarios available. Monitoring starts explicitly and operates within the limitations of an open browser application.

Do not add a separate heartbeat subsystem or pending-transaction grace periods to the final release unless a concrete demonstration need is identified. Those candidates add less value to the current daily-record model than reliable delivery monitoring and investigation usability.

Acceptance: on-time and zero-activity deliveries avoid false alerts; missed deadlines generate one case; repeated evaluation/replay does not duplicate cases; invalid recovery cannot clear a case; valid recovery can be verified; state survives reload; Phase 1 tests continue to pass.

## Phase 3 — Proactive risk management (implemented)

Complete the analyst and management workflow after Phase 2 is verified:

- Provide an actionable overview of current financial differences, unavailable evidence, affected customers, unresolved cases and overdue actions, with links to the supporting records.
- Link related findings for investigation where evidence supports the relationship. Preserve individual check results; do not assert a common root cause merely because amounts match.
- Derive financial indicators from the latest applicable reconciled position. Do not sum overlapping aggregate/transaction/customer findings, repeat snapshots across dates, or resolved financial differences as additional exposure. Present allocation problems separately from pooled-account shortfalls, and show unknown/unassessable positions clearly.
- Add simple, explained risk categories and documented demonstration thresholds. Show why an issue has its priority; avoid an opaque score or claims that thresholds are regulatory requirements.
- Add idempotent risk-based escalation using the agreed policy, with reasons and evidence in the activity history.
- Recommend concrete human actions, such as obtaining replacement records, investigating a transaction, assigning an owner or requesting management review. Recommendations must reflect current state and must not execute banking restrictions.

Implemented policy: use the latest applicable business date and rechecked snapshot; never sum overlapping findings or daily positions. Show Unknown/Not assessable for incomplete evidence. High review applies to an absolute pooled gap of at least $250 or any transaction allocation mismatch; these are demonstration rules. Qualifying current financial cases are referred once, with evidence and reasons. An unresolved administrative case and a currently observed financial difference remain separate measures: corrected records clear the gap while cases await documented closure.

Acceptance: the $400 demonstration is never displayed as $1,200 exposure; repeat runs and repeated daily snapshots do not inflate the position; matching pooled totals do not conceal allocation findings; unavailable evidence is not displayed as zero risk; priorities and recommendations change when verified inputs change; all earlier regression tests pass.

## User experience priorities across Phases 2 and 3

- Keep outcomes, feed health and investigation status visually distinct.
- Explain unfamiliar checks, inputs and status labels briefly at the point of use.
- Make the next useful action obvious: inspect evidence, obtain records, assign, investigate, recheck or resolve.
- Make related runs, findings and activity history easy to navigate without losing investigation context.
- Provide clear feedback for successful actions, blocked actions, loading, validation failures and unsaved changes.
- Improve filtering, readable evidence comparisons, responsive layouts, keyboard operation and accessible status communication where they improve the existing workflow.
- Preserve existing saved work through tested storage migrations. Keep demonstration scenarios easy to start and reset without accidental data loss.
- Finish with coherent demo scenarios, automated regression coverage, documentation and preparation for eventual static hosting. Complete the required short guide and backup demo materials as separately agreed submission work.

## Explicit exclusions

No automatic fund freezes or service restrictions, real banking APIs, authentication, multi-bank expansion, ML, shared backend or enterprise rule builder. Do not add new top-level screens without a clear workflow need. Do not begin a fourth phase or expand the final release simply to increase feature count.

Phases 1–3 are complete for review. Phase 1 remains the working baseline. See the phase verification reports for tests and limitations. No fourth phase, deployment or automatic banking restrictions are included.
