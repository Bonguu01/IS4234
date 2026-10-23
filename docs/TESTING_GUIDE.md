# LedgerWatch groupmate testing checklist

Start with the [README setup and main demo](../README.md#first-time-here-start-here). You can test the application manually without running automated tests or understanding the code.

Use synthetic records only. Each browser and URL has its own saved workspace. **Reset workspace → Clear workspace** deletes that workspace, including cases, history and the advanced clock. Reset between independent scenarios when you want predictable counts, but keep the same workspace during a discrepancy → investigation → correction sequence.

## 1. Main workflow

Follow the README’s [10-minute demo](../README.md#try-the-main-demo-about-10-minutes).

- [ ] Matching records produce Passed, Clear, $0 gap and no cases in a fresh workspace.
- [ ] The $400 discrepancy produces Exceptions, a $400 gap, one flagged customer and three cases.
- [ ] Repeating the run does not duplicate cases or risk referrals.
- [ ] Assigning an owner and saving an investigation note survive refresh.
- [ ] A case cannot be resolved while its discrepancy is still present, even with an owner and reason.
- [ ] Advancing 25 hours adds Overdue badges without changing records or the business date.
- [ ] Corrected records produce Passed and a $0 current gap, while existing cases remain open.
- [ ] Each case needs an owner, verified correction and resolution reason before closure.
- [ ] A resolved case loses its active Overdue badge and stays resolved after refresh.

The three $400 findings overlap; they are not a $1,200 loss. Overdue describes the deadline, Escalated describes a referral, and Open / Investigating / Resolved describe the workflow. The $400 scenario escalates immediately under the demo risk policy, before it is overdue.

## 2. Other reconciliation scenarios

For each row, reset, open **Reconciliation → Manual CSV records**, select the named **Sample scenario**, click **Load Sample Scenario**, then **Run reconciliation**.

| Scenario | Expected result |
| --- | --- |
| 04 · Customer allocation error | Exceptions and a High position, despite $0 pooled gap. Two customer records are flagged: matching totals do not establish correct ownership. |
| 05 · Missing intermediary feed | Blocked; position Unknown / Not assessable, not a confirmed $0 gap. The missing closing ledger creates a critical source case and immediate escalation. |
| 06 · Stale intermediary feed | Blocked; the closing ledger covers 19 October rather than the expected 20 October. An old file cannot verify the selected date. |

- [ ] Inspect failed checks and source errors to understand the result.
- [ ] After a missing/stale case, load Matching records and rerun without resetting. Verify recovery permits documented closure, but does not automatically resolve the case.

## 3. Upload a genuinely changed CSV

1. Reset, load Matching records and run reconciliation.
2. Expand **Intermediary balances → Inspect → Download source CSV**. Save a separate test copy.
3. Open it in a text editor such as Notepad. Change CUS-001’s `closing_balance` from `1500.00` to **`1501.23`**. Keep all other fields unchanged.
4. Upload the edited file under **Intermediary balances**. Keep reconciliation and coverage dates at **20 October 2026**.
5. Keep **CSV date format → YYYY-MM-DD (standard)** if the file contains `2026-10-20`. If you edited in Excel and it saved `10/20/2026`, select **MM/DD/YYYY (month first)** instead. The date picker’s appearance does not determine the CSV’s format.
6. Click **Run reconciliation**.

Expected: **Exceptions**, a **$1.23** pooled gap, a **Review** position and three findings: aggregate, customer balance compared with bank transactions, and customer balance compared with intermediary transactions. The latter two have distinct labels below their issue types and inside their case drawers. The ledger reports a balance that neither set of transactions supports. This differs from the built-in $400 example, whose intermediary ledger is internally consistent.

- [ ] The actual gap is $1.23, not a predefined sample amount and not three times that amount.
- [ ] The small financial discrepancy is not immediately referred by the $250 policy. Finding priority High and current position Review are separate labels.
- [ ] Open **Demo deadline clock → Advance 25 hours**. The three unresolved cases become Overdue and are escalated under the 24-hour policy.
- [ ] The date and gap remain unchanged; activity history distinguishes actual event time from deadline-clock time.
- [ ] Upload the original valid CSV and rerun. Only then should affected cases be eligible for documented closure.

## 4. Invalid inputs and recovery

Start each row from a fresh Matching scenario. Edit a separate CSV copy, upload it to its matching source, and run. Use **Inspect** to read all validation errors. Restore the original file and rerun between tests.

| Change | Expected handling |
| --- | --- |
| Set a closing balance to `1500.001` | Invalid source and Blocked run: more than two decimal places are rejected. |
| Put `10/20/2026` in the file while the selector is YYYY-MM-DD | Invalid and Blocked; selecting month-first makes correctly dated rows usable without a re-upload in the manual workspace. |
| Put `02/30/2026` in the file and select month-first | Invalid and Blocked: an impossible date cannot be normalised. |
| Put `10/21/2026` in the file with month-first selected and coverage still 20 October | Invalid and Blocked: format acceptance does not bypass coverage matching. |
| Duplicate a customer balance row | Invalid and Blocked: duplicate record keys are rejected. |
| Change a customer ID to `UNKNOWN` | Invalid and Blocked: customer references must exist in the opening baseline. |
| Delete the `closing_balance` header | Invalid and Blocked with a missing-column error. |
| Click Remove on a required source | Missing and Blocked; an earlier Passed result is not evidence for the changed inputs. |
| Remove only CUS-001’s closing row, keeping the CSV valid | Exceptions, including a missing customer balance; an absent balance is not treated as zero. |
| Select a file of 1 MB or more | Upload error; previous evidence for that source is withdrawn, preventing a false Passed result. |

- [ ] Collapsing an invalid source row keeps its status/error visible.
- [ ] Replacing a verified correction revokes closure permission until a new applicable successful recheck.

## 5. Missing delivery and automatic recovery

Reset first so an advanced clock or previous cases do not affect the test. Open **Demo guide → Show a missed delivery → Start missed-delivery demo**. In **Delivery monitoring**, click **Next replay event** three times:

| Click | Expected result |
| --- | --- |
| 1 | Transactions arrive; balances remain Awaiting delivery. There is no financial run from incomplete evidence. |
| 2 | The closing-ledger deadline is reached. One critical delivery case is created, escalated and overdue. |
| 3 | The ledger arrives; both sources validate and trigger automatic reconciliation. Delivery complete and Passed should appear. |

- [ ] Repeated checks do not create duplicate delivery cases.
- [ ] The recovered case stays open until an owner and resolution reason are supplied.
- [ ] A manual-workspace run cannot substitute for the monitored snapshot’s required recovery check.

Reset between the other demos under **Reconciliation → Delivery monitoring**. Choose a scenario, click **Start monitoring demo**, then step through its replay events:

| Scenario | Replay clicks | Expected result |
| --- | --- | --- |
| On-time delivery | 2 | Delivery complete, Passed and no delivery-failure case. |
| Invalid delivery and recovery | 3 | Invalid balance delivery creates a case; corrected delivery triggers Passed. |
| Stale delivery and recovery | 3 | Old coverage creates a case; current coverage triggers Passed. |
| Quiet day with zero transactions | 2 | A valid empty transaction file counts as received; unchanged balances pass. |
| Delivered records with a discrepancy | 2 | Delivery complete, but financial Exceptions and a $400 gap. |

The five-minute delivery window is simulated, but time also elapses normally while the app is open. Perform the on-time steps promptly; advancing the clock first can correctly make deliveries late. Under **Window actions**, Stop monitoring pauses new delivery checks; the shared clock continues. Resume monitoring checks elapsed deadlines.

## 6. Usability and saving

- [ ] **Filters → Queue view → Overdue** shows unresolved cases at their deadline.
- [ ] **Unassigned** excludes cases with owners and resolved cases.
- [ ] **Ready to close** shows unresolved cases with an owner and verified correction; a resolution reason is still required.
- [ ] Searching by case ID, customer/transaction reference or owner finds the relevant cases. **Clear search and filters** restores the queue.
- [ ] Supporting-run and verified-correction links open the intended stored run.
- [ ] Narrow the browser window or use a phone-sized viewport. Cases become readable cards, and primary controls remain accessible.
- [ ] Keyboard Tab reaches controls and check explanations; Escape closes menus/dialogs.
- [ ] Refresh preserves data on the same browser and URL. Another browser, device, port, or `localhost` versus `127.0.0.1` has separate storage.

## Reporting an issue

Send the group: scenario name, whether you reset first, exact steps, any clock advances, expected result, actual result, and a screenshot. For CSV issues attach the synthetic file and selected date format/coverage date. Include the browser and printed local URL. Record the evidence before resetting; clearing the workspace removes the history needed to reproduce the issue.

For automated checks, see [Tests and build](../README.md#tests-and-build). Browser tests use isolated test profiles, so they do not exercise or change your ordinary demo workspace.
