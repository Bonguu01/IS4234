# LedgerWatch — Phase 1 implementation plan

This document records the approved Phase 1 scope. Phases 2 and 3 are boundaries for future work, not implementation requirements; see [ROADMAP.md](ROADMAP.md).

## Purpose and evidence boundaries

LedgerWatch is a bank-side synthetic control demonstrator for IS4234. It compares independently supplied bank records with intermediary records, identifies unusable evidence or discrepancies, and supports accountable investigation and escalation.

Synapse’s April 2024 bankruptcy and the customer-fund reconciliation crisis are distinct. This prototype does not assert that Evolve’s weaknesses caused that bankruptcy. Customer-linked bank transactions and an agreed opening baseline are proposed synthetic control improvements, not historical claims about Evolve’s systems. It does not determine liability, prove theft, locate external funds or certify regulatory compliance.

## Scope and frontend

- One fictional Northstar Bank (`BANK-001`), Bridgeway Technologies intermediary (`PARTNER-001`), and USD FBO account (`FBO-001`). Keep these identifiers in joins and finding keys for future extension.
- React + JavaScript + Vite, Mantine core/hooks, CSS Modules, Lucide React, Papa Parse, locally bundled Inter. Mantine Table suffices; no TanStack Table or second component library.
- Follow `LedgerWatch Exceptions Dashboard.png` for visual direction: background `#F8FAF9`, cards `#FFFFFF`, accent `#16866A`, text `#17233A`, borders `#E6EAE8`. Use restrained badges, generous whitespace, subtle borders and a responsive navigation rail.
- Three screens: Dashboard, Reconciliation and Exceptions. Metrics must be derived from real application state. Do not reproduce the mockup’s fictitious figures, extra screens, charts, risk rules or cumulative exposure estimate.
- Persist application state in versioned browser localStorage. No shared backend, login, real financial data, banking APIs, funds movement, ML or enterprise infrastructure.

## Architecture and CSV contracts

Keep CSV validation, exact money arithmetic, reconciliation, case lifecycle, clock policies, storage and UI separate. Pure domain functions must not depend on React, Mantine or localStorage. React context/reducer-style state transitions and derived views connect the screens.

All rows include `bank_id`, `partner_id`, `fbo_account_id`, `currency`, and `business_date`.

| Source | Other required fields |
| --- | --- |
| `bank_balances.csv` | `opening_balance`, `closing_balance` |
| `customer_opening_balances.csv` | `customer_id`, `opening_balance` |
| `bank_transactions.csv` | `transaction_ref`, `customer_id`, `amount` |
| `intermediary_transactions.csv` | `transaction_ref`, `customer_id`, `amount` |
| `intermediary_balances.csv` | `customer_id`, `closing_balance` |

Use one daily window, non-negative balances and posted signed transactions: credits positive, debits negative. Preserve IDs as strings and convert strict decimal amounts into integer cents. Reject excess precision, unsafe amounts, malformed dates, unsupported scope/currency, duplicate references, missing columns and customers absent from the baseline. Opening customer totals must agree with the bank opening total. Explicitly dated header-only transaction files may represent zero activity; empty baselines or balance files cannot.

Capture filenames, actual import timestamps, content fingerprints, raw CSV text, declared coverage dates and row evidence. Fingerprints identify demo inputs and do not authenticate them. Keep run snapshots, findings, investigation cases and activity events separately.

## Processing and investigation

1. Assess each feed’s availability, validity and coverage against the selected reconciliation business date. Older coverage is stale; future coverage is invalid. Missing or unusable sources create critical cases and block dependent checks.
2. Compare customer opening totals to the bank opening balance.
3. Check bank opening balance plus net posted bank transactions against its closing balance.
4. Compare intermediary customer closing totals with the bank closing balance.
5. Full-outer-join transaction references within the bank/partner/account/currency/date scope; detect missing records on either side, amount differences and allocation differences.
6. Reconstruct customer closing balances using the opening baseline plus bank transactions, and compare against the intermediary ledger. Separately check intermediary movements against its own closing balances. An inconsistent opening baseline blocks customer reconstruction.
7. Return individual checks and an overall **Passed**, **Exceptions** or **Blocked** outcome. Passed requires all required checks to complete without findings. Blocked takes precedence when evidence/calculations are unusable. Differences across checks may overlap and must not be summed as losses.
8. Generate cases from findings. Deduplicate by rule, scope, business date and entity/reference. Preserve every run without duplicating cases. A different business date is a different investigation window.
9. Support owner assignment, investigation notes, Open/Investigating/Resolved statuses, manual escalation with reasons, and saved evidence history. Require an owner before investigation. Resolution requires an owner, a note and a successful applicable recheck that no longer detects the issue. Blocked or unrelated checks cannot clear a case. Reopen findings that recur.
10. Escalation is separate from status. Critical source failures escalate immediately; other unresolved cases escalate after 24 deadline-clock hours. Route referrals to Risk / Compliance in the application; send no external messages. Evaluate on load, after actions and periodically while open. Persist each escalation once.

## Sample bundles and independent clocks

**Load Sample Scenario** stages all five CSV sources through the same parsing path as manual uploads. Keep the Run action separate. Include matching records, a $400 discrepancy, corrected records for the same date, customer allocation errors with matching aggregates, an unavailable intermediary ledger and a stale intermediary ledger. The unavailable scenario deliberately leaves the affected source slot absent. Loading bundles replaces staged inputs but retains investigation/run history. Keep manual uploads, per-source coverage dates, inspection, removal and source CSV downloads.

Use actual system timestamps for imports, runs and all activity. Store a separate business/deadline clock to demonstrate SLA expiry. Initial business time equals system time and advances normally, with explicit forward demonstration offsets. Record actual occurrence and effective business time on escalation actions. Advancing this clock must not change selected reconciliation dates, imported records, source coverage/freshness or historical system timestamps. A confirmed workspace reset clears local state and resets the clock.

## Incremental delivery and testing

1. Establish documentation, fixtures and CSV contracts.
2. Initialise Vite/Mantine, theme, navigation and persistence.
3. Implement/test validation and reconciliation before UI polish.
4. Implement/test case deduplication, notes, assignments, resolution and escalation.
5. Connect all three screens to stored data.
6. Verify bundled/manual inputs and independent clock behaviour.
7. Run Vitest/React Testing Library tests, Playwright browser acceptance tests and production build. Check desktop/mobile layouts and console errors.
8. Document launch/test commands and static-hosting preparation; stop after Phase 1 for user review.

Acceptance includes exact cents, matching records, a calculated $400 difference, customer errors despite aggregate agreement, missing/stale/invalid records, duplicate keys, record changes affecting results, repeated runs without duplicate cases, persisted investigations, rejected premature resolution, successful correction/recheck/resolution, recurrence, and one escalation per deadline event. Clock tests must prove imported dates and actual timestamps remain unchanged.

Prepare a relative-path Vite static build with hash navigation for eventual hosting. No deployment is authorised in this phase. The eventual submission needs an accessible hosted link, at most two-page guide, at most five-minute backup video, supporting files and appropriate AI-use acknowledgement.

## Limitations

Local state is browser/origin-specific, editable and quota-limited. Save/load failures must be visible, and damaged stored data must not be silently overwritten. Actor labels are not authenticated. The activity history is not a tamper-proof audit trail. No deadline execution occurs while the browser is closed; overdue checks run when reopened. Inputs and declared coverage cannot prove external authenticity or completeness. Settlement timing, fees, house funds, interest allocation, overdrafts and cross-bank sweeps are outside this model.
