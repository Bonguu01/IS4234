# Phase 3 — current position and analyst workflow

This is the final planned release. It adds explained financial indicators, local risk referrals and navigation between evidence and investigations. It retains all Phase 1/2 controls and the three screens. No funds are frozen, restrictions executed, messages sent or real banking services connected.

## Position policy

- Select the greatest reconciled business date, then the last completed run for that date. Replaying an older day cannot replace a newer position. Never add daily snapshots or check amounts together.
- A new monitoring window for that date (started at/after the selected run), or a later date, takes precedence while its current evidence awaits recheck. An incomplete/invalid replacement cannot inherit an older Passed position. Stopping monitoring does not validate missing evidence.
- A later staged manual business date with source records is unassessed until run. For the selected manual run's date, changed source content, declared coverage or scope requires recheck. Filenames/import timestamps alone do not change financial content.
- Manual and monitored snapshots remain independent. Show the chosen origin and business date. Loading an older scenario is not a new current financial position; its own run remains inspectable.
- Changed inputs in a verified case's source context/date revoke its closure permission until a successful applicable recheck. Unrelated manual staging cannot invalidate a monitored proof; previous business dates retain their recorded proof. This guard also applies on reload and before case actions.
- Any Blocked required check makes the overall financial position **Not assessable**. Do not show an unknown position as $0 or zero affected customers. Available source/check details remain inspectable.

## Calculations

- Signed pooled balance gap = intermediary closing-balance total minus bank closing total, from the selected completed aggregate check, in integer cents. Positive means the intermediary ledger exceeds the bank balance; negative means the bank balance exceeds the ledger. Neither is a proven loss or legal entitlement calculation.
- Customer discrepancies = unique customer IDs implicated by transaction/customer/ledger findings. For a transaction allocation mismatch, include both recorded customer IDs. Do not count every customer simply because the aggregate evidence contains their balances. This counts records implicated by findings, not proven harmed people.
- Allocation mismatches are identified by actual transaction customer-ID disagreement; zero pooled gap does not imply correct allocations. Other offsetting customer differences are labelled discrepancies, not asserted to have one root cause.
- Open case count, overdue actions and verified cases awaiting closure are administrative measures, including earlier dates. Corrected records can produce a clear financial position while cases remain open. Case amounts are never an exposure sum.

## Demonstration risk policy v1

| Category | Rule |
| --- | --- |
| Unknown | No applicable successful assessment, changed inputs, incomplete delivery or any Blocked required check |
| High | Absolute assessed pooled gap >= **$250.00**, or >= 1 transaction allocation mismatch |
| Review | Other assessed financial findings, including smaller or offsetting differences |
| Clear | All checks Passed for the selected inputs |

These are explicit demonstration thresholds, not regulatory rules or a production risk model. Categories describe this record comparison, not the bank's overall risk.

For a High current position, automatically refer unresolved, currently detected financial cases for its scope/date to Risk / Compliance. Store policy version, supporting run, gap/allocation indicators, actual timestamp and reason. Existing escalations remain intact; repeated evaluation/runs/reload cannot duplicate a referral. Resolved/cleared/historical cases do not receive new current-position referrals. Recurrence reopens through the existing lifecycle and can receive a fresh referral. Source failures retain Phase 1/2 escalation rules. Unknown positions never generate invented monetary escalations.

Recommendations are human actions derived from current state: obtain records, run/recheck, review with management, inspect customer differences, assign an owner or document verified closure. They do not execute banking actions.

## Investigation and demonstration UX

- Dashboard: position, four concise indicators, a short next-action list and compact delivery health. Policy, source details and longer history are expandable.
- Reconciliation: retain sample/manual uploads; explain the selected scenario in one short sentence. Show results and failed checks first; passing details remain available without dominating the page.
- Exceptions: link to the supporting/verification run and related cases by shared transaction/customer evidence or explicitly labelled shared snapshot context. Never infer a common cause from equal amounts. Show readable evidence fields before technical JSON.
- A global Demo guide gives a short walkthrough and scenario explanations. Scenario buttons stage real CSV bundles; calculations still require Run reconciliation. Keep prior cases/history and reset only through existing confirmation.
- Preserve exact outcome/status labels, keyboard operation, mobile cards and all guards. Keep the stored schema/key compatible; validate optional risk-referral metadata and test legacy workspaces.

## Verification

Test threshold boundaries, signed/offsetting gaps, allocation without pooled shortfall, missing evidence, blocked arithmetic, repeated runs/dates, older replay, current-source replacement, correction before closure, deduplicated referrals, recurrence, legacy storage and linked evidence navigation. Run all Phase 1/2 regressions, browser workflows and static production build. Review screenshots at desktop/mobile sizes. Finish with README/demo instructions and a verification report; stop for review.
