# Phase 1 verification — 22 October 2026

## Results

- **98 unit/component tests passed** across five test files.
- **6 Playwright browser tests passed** using installed Chrome in headless mode.
- **Production build passed** with Vite.
- Phase 2 and Phase 3 were not implemented during this verification.

## Coverage

| Area | Scenarios verified |
| --- | --- |
| Financial checks | Matching records, calculated $400 differences, changed CSV values, aggregate agreement with customer allocation errors, missing transactions on either side, missing customer balances and inconsistent opening baselines |
| Exact money | Decimal-to-cent parsing, signed movements, precision rejection, unsafe amounts, aggregate overflow and exact display at the safe integer limit |
| CSV validation | Each missing source, duplicates in every source, empty required balance/baseline files, valid zero-activity transaction files, missing/duplicate headers, broken quotes, wrong row widths, unsupported scope/currency, unknown customers, negative balances and invalid/future/stale coverage |
| Valid CSV variations | UTF-8 BOM, CRLF, quoted cells, whitespace, extra informational columns and reordered records |
| Case workflows | Assignment requirements, blank-note/reason rejection, invalid actions/statuses, deduplication, distinct business dates, correction/recheck requirements, recurrence and history preservation |
| Deadlines | Exactly 24 hours versus one millisecond before, immediate critical escalation, manual referral, duplicate prevention, resolved-case exclusion and separate actual/business clocks |
| Upload failures | File-read rejection, the strict smaller-than-1-MB boundary, reconciliation while a replacement is reading, out-of-order completions and late reads after scenario loading/removal/reset |
| Persistence/recovery | Round-trip runs/notes/assignment, reload, malformed JSON, nested damage, invalid stored monetary display values, unsupported versions, denied storage, quota errors and preservation until explicit reset |
| Browser/UI | All five manual uploads, bundle loading, displayed filename replacement, Passed/Exceptions/Blocked outcomes, dashboard data, investigation-to-resolution workflow, warnings and mobile layout |

## Issues found and fixed

1. **Incomplete saved-state validation:** valid JSON could contain damaged nested runs, cases, events or source records and later break the UI. Loading now checks the structures used by the application, warns safely and preserves the original stored evidence until the user explicitly resets it. This is structural validation, not protection against deliberate tampering.
2. **Fallback to superseded evidence:** a failed or unfinished replacement upload could leave an older valid source available for reconciliation. Selecting a replacement now makes that source unavailable immediately; failures are reported and cannot silently reuse the old file for a Passed result.
3. **Late file-read overwrites:** a slow earlier upload could overwrite a newer upload or a newly loaded scenario, or restore a removed/reset source. Upload request and workspace generation checks now ignore superseded completions.
4. **File-size boundary:** the implementation now rejects files of 1 MB or larger, matching the documented requirement that files must be smaller than 1 MB.

## Reproduce

```powershell
npm.cmd test
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
npm.cmd run build
```

Browser tests use isolated test contexts and a temporary server on port 4173; they do not reset a tester's normal browser workspace. Tests and generated screenshots/traces are described in the README.

## Readiness and limits

No failing tests remain in this verification. Phase 1 is ready for a Phase 2 design review. Coverage targets the current CSV contracts and workflows; it cannot establish correctness for every possible input or future feature.

Existing limits remain: browser-local editable storage, one fictional bank/intermediary/account, USD posted daily records, device-based timestamps and no execution while the browser is closed. Shared storage, authentic source verification and banking integrations remain outside Phase 1. Heartbeats, event replay and pending-transaction grace periods require separate Phase 2 policies and tests.
