# Phase 2 verification — 22 October 2026

## Results

- **136 unit/component tests passed** across six files, including all Phase 1 regressions.
- **16 browser tests passed** in headless Chrome: six original acceptance tests, five monitoring/migration flows and five usability/edge-case flows.
- **Production build passed**. Vite reports a non-blocking warning for the approximately 537 kB main JavaScript chunk (approximately 164 kB gzip); no additional dependencies were introduced.
- Phase 3, separate heartbeats and pending-transaction grace periods remain unimplemented. No site was deployed.

## Verified Phase 2 behaviours

| Area | Verification |
| --- | --- |
| Explicit monitoring | Starts inactive; requires valid bank source coverage for the chosen business date; captures an independent bank snapshot without changing manual uploads |
| Deadline detection | Five simulated minutes; no premature case; absent sources generate one critical case per feed at the deadline without transactions or a manual financial run |
| Periodic execution | A fake-clock integration test exercises the actual 15-second application timer; repeated checks do not add duplicate cases or activity |
| Delivery validation | Actual CSV parsing detects invalid precision, stale coverage and unusable sources; failed reads replace prior evidence with an invalid receipt rather than silently reusing it |
| Quiet periods | Header-only valid transaction delivery with unchanged balances produces a genuine Passed reconciliation, not an outage alert |
| Financial independence | Complete usable delivery can produce Exceptions; no assumption that availability establishes financial agreement |
| Replay | Six deterministic input scenarios; persisted progress; no backward clock movement; duplicate delivery IDs ignored; periodic checks do not duplicate financial runs |
| Recovery | Partial, invalid, discrepant or Blocked recovery does not clear delivery cases; both current valid sources and an automatic Passed snapshot enable documented resolution |
| Investigation | Same owner/note/escalation/history controls; manual-workspace runs cannot clear delivery cases; verified recovery leaves cases open; renewed failure can reopen a resolved case |
| Clock separation | Actual recording timestamps and business dates remain unchanged when simulated delivery time advances |
| Stop/resume | Stopping retains cases and the shared clock; resume detects elapsed deadlines; no implicit next-day scheduling |
| Persistence | Version-1-to-2 migration preserves datasets, cases, clocks and history; corrupt monitoring state is rejected without overwriting saved data; replay/custom receipts survive reload |
| Upload ordering | A late monitoring upload cannot overwrite a restarted scenario; superseded manual uploads retain their earlier protections |
| UI | Manual/monitoring input tabs, current delivery health separate from financial outcomes, snapshot inspection, evidence history, desktop/mobile layout and original manual workflows |

## UI refinement and additional audit

The Mantine design keeps the reference's off-white background, white cards, muted green accent and navy text. Refinements focus on understandable controls:

- Reconciliation has a three-step workflow guide, calculated source-readiness counts and separate source/financial check groups. Each financial check has a brief explanation.
- Passed, Exceptions and Blocked have distinct summary panels, icons and status labels. Historical results identify their origin and remain visibly separate from staged inputs.
- The Dashboard calls its outcome the **last completed outcome**. A changed monitoring snapshot explicitly warns that a previous stored result does not verify the new deliveries.
- Investigations show owner, verified-correction and resolution-reason requirements. Evidence and activity have expandable sections; source-level evidence no longer displays a fictitious CSV row number.
- Dashboard actions open the correct input tab. Explicit tab choices survive reload and browser Back navigation. Reset with confirmation is also available on mobile. The mobile exception queue uses case cards with visible investigation buttons instead of a wide table.

Additional regression checks cover concurrent monitoring uploads superseded by stop/reset/replay/newer selection; an oversized replacement after a Passed run; overdue detection after reopening; new monitoring windows revoking old recovery permission; historical-result selection; investigation search/requirements/evidence; keyboard tab changes; and mobile controls without page overflow.

Two audit fixes have regression tests:

1. A new invalid receipt with the same validation error now refreshes the existing case's latest evidence and receipt metadata. It does not create a duplicate case or repeated timer alerts. Prior receipt activity remains in history; source evidence represents the latest detection, not a version archive of every failed file.
2. Saved correction flags must be actual booleans. Damaged values such as the string `"false"` are rejected without overwriting storage, rather than being treated as truthy resolution permission. This is data-integrity validation, not protection against deliberate browser-state tampering.

Desktop and mobile screenshots were generated during browser tests and reviewed for the result hierarchy, investigation layout and responsive controls.

## Reproduce

```powershell
npm.cmd test
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
npm.cmd run build
```

Browser tests use isolated contexts, leaving the tester's normal browser storage untouched. They start/stop the test server on port 4173. Screenshots and traces are in ignored `test-results/`.

## Try it manually

Run `npm.cmd run dev`, open the printed local URL, then choose **Reconciliation → Delivery monitoring → Missing delivery and recovery → Start monitoring demo**. Step through transaction delivery, the missed closing-ledger deadline and recovery with **Next replay event**. Inspect the generated case and its source evidence before resolving it after the automatic Passed recheck. Full instructions are in [README.md](../README.md).

## Limits

Monitoring runs while the browser application is open and reevaluates elapsed deadlines on reopening. It is a synthetic daily-delivery control, not a production scheduler or continuous banking integration. Each window starts explicitly; there is no automatic rollover, real API, heartbeat or pending-transaction service. Storage and device clocks remain browser-local and editable. Tests cover specified inputs and failure paths, not every possible input or production readiness.

Phase 2's regression and usability checks pass, with no known blocker in the covered workflows. This is readiness to scope Phase 3, not proof that every possible input is covered or a production certification. Phase 3's risk calculations and thresholds still require their own implementation specification and tests; no Phase 3 behaviour has been added.
