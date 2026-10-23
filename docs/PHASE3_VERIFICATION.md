# Phase 3 verification — 22 October 2026

## Results

- **169 unit/component tests passed** across seven files, including the Phase 1/2 regression suites.
- **28 Chrome browser tests passed**: 16 earlier acceptance/usability flows, eight Phase 3 workflows and four progressive-disclosure workflows.
- **Production build passed**. Vite retains a non-blocking JavaScript chunk-size warning; no new dependencies were added.
- **One additional production-browser workflow passed** against the actual `dist/` bundle: matching records → $400 discrepancy → risk referral → investigation → correction → documented resolution.
- All three planned phases are implemented. No deployment, fourth phase, fund movement, freeze, service restriction or external message was performed.

## Financial and workflow verification

| Area | Covered behaviour |
| --- | --- |
| No double counting | $400 remains one $400 pooled gap despite three findings; repeated runs and daily snapshots do not accumulate exposure |
| Exact thresholds | Signed gaps immediately below, at and above ±$250 are classified using integer cents |
| Allocation | Zero pooled gap does not conceal transaction allocation mismatch; both customer IDs are counted once |
| Other customer differences | Offsetting customer balances produce detailed findings without an invented common root cause or allocation mismatch |
| Unknown evidence | No run, unprocessed inputs, missing/stale sources, blocked reconstruction and withdrawn deliveries are Not assessable; there is no fallback to an older pass |
| Position selection | Latest business date takes priority; later execution of an older day's Passed run cannot hide a newer discrepancy; newer unprocessed/manual/monitoring context requires recheck |
| Case/position distinction | Correction clears the financial gap but retains open cases until documented closure |
| Risk referrals | Qualifying current cases receive policy/run/time/reason evidence; repeat evaluation, repeat runs and reload do not duplicate referrals; existing analyst referrals are preserved |
| Recurrence | Resolved findings can reopen through the existing lifecycle and receive a fresh applicable referral |
| Closure permission | Replacing corrected manual/monitored evidence revokes permission; incomplete replacement cannot reuse an old successful proof; valid fresh recheck restores eligibility |
| Context separation | Unrelated manual staging does not invalidate valid monitored proof; previous business dates retain their historical proof |
| Related evidence | Links use shared transaction/customer references or explicitly labelled snapshot context, constrained to scope/date; equal amounts alone do not imply a common cause |
| Storage | Existing version-2 state loads without migration; optional referral metadata is validated; damaged data is preserved rather than overwritten; prior version-1 migration tests continue to pass |

Unit/component breakdown: reconciliation 24, baseline workflow 9, prior edge cases 61, monitoring 26, risk 32, state integration 15 and connected UI 2.

## User experience verification

The browser suite exercises the actual interface and uploaded/generated CSV contents. It verifies the global Demo guide, scenario loading without automatic fake outcomes, direct next-action links, assignment/notes, readable source evidence, related investigations, exact supporting-run navigation, correction and closure. Reload retains the selected case and its records. Missing case/run links show a recoverable message. Keyboard Tab displays financial-check explanations, and Escape closes the guide and restores focus.

Desktop (1440px), mobile (390px) and tablet (1024px) layouts were checked. Mobile case cards retain visible investigation actions; page overflow checks pass. Screenshots were reviewed for the position hierarchy, status clarity, readable evidence and reduced copy. Long policy text, source checks, referral details, activity, technical records and receipt metadata remain available through expandable sections or Inspect. Failed financial checks are displayed first. Linked runs scroll to their results.

The subsequent [progressive-disclosure pass](UX_DISCLOSURE.md) replaces five expanded upload cards with compact source rows, groups secondary monitoring actions in a menu and places exception filters in a dropdown. Tests verify manual uploads/inspection through the rows, validation errors visible after collapse, applied-filter counts/criteria, filter clearing, keyboard menu dismissal and mobile placement. Expanding or inspecting does not alter saved records. All original workflows continue to run through the updated controls.

Screenshots/traces are generated in ignored `test-results/`; the normal browser's saved workspace is untouched by isolated acceptance-test contexts. The in-app guide and [short demo script](DEMO_SCRIPT.md) explain a practical presentation route. The original approved Phase 1 [PLAN.md](../PLAN.md) remains intact; [ROADMAP.md](../ROADMAP.md) records the final boundaries.

## Reproduce

```powershell
npm.cmd test
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run test:production
```

Chrome must be installed for the channel above. Otherwise install Playwright Chromium as described in README and omit that environment variable. The development browser suite uses port 4173; the production-bundle check uses port 4174.

## Limits and review boundary

These are tested prototype policies, not regulatory requirements, a comprehensive bank risk model or proof that uploaded files are authentic/complete. The pooled gap is not a proven loss or legal entitlement calculation; customer counts identify implicated records. Unknown positions have no invented monetary estimate. Historical case amounts are retained evidence, never a cumulative exposure figure.

State remains browser-local, editable and quota-limited; staff identities are fictional and unauthenticated. Monitoring/escalation run while open and on reopening, not through a closed-browser service. Scope remains one bank/intermediary/FBO account, USD and daily posted records. There are no real APIs, pending-transaction models or interbank sweeps. Retained snapshots consume local storage. Tests cover specified cases, not every possible input.

The static build is ready for local review, with its documented bundle-size warning. Hosting, the two-page maximum PDF prototype guide and backup video remain separate submission tasks. Stop here for the user's review; no fourth phase is planned.
