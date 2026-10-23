# LedgerWatch

LedgerWatch is a prototype that compares a bank’s financial records with an intermediary’s records, flags discrepancies or missing data, and helps staff investigate, escalate and resolve the issues.

Built for IS4234 using React, Vite, Mantine, CSS Modules, Lucide React and Papa Parse. **Phases 1–3 are implemented. All records are synthetic; no login, banking connection or real money is required.**

## First time here? Start here

1. Download/extract the project or clone the shared repository. Open a terminal in the folder containing **`package.json`**. You do not need the original case-study PDFs to run the application.
2. Install Node.js and npm if needed. The project baseline is **Node.js 22.14 or newer supported LTS**. Check your installation with `node --version` and `npm.cmd --version`.
3. Run these commands in that folder:

```powershell
npm.cmd ci
npm.cmd run dev
```

`npm.cmd ci` installs the exact dependencies from `package-lock.json`; it needs internet access on first setup. On macOS/Linux use `npm` instead of `npm.cmd` for every command. Windows users can use `npm.cmd` to avoid PowerShell script-execution-policy restrictions.

4. Open **http://127.0.0.1:5173**, or the URL printed in the terminal if that port is occupied. Keep the terminal running. Stop the server with **Ctrl+C** when finished. On later visits, run only `npm.cmd run dev` unless dependencies changed.

Each groupmate runs their own copy. No API keys, environment file, backend or account setup is needed. Records and investigations are saved **in that browser**, not shared between groupmates. Use the same browser and URL each time to return to your saved workspace.

## Try the main demo (about 10 minutes)

For a clean start, use **Reset workspace → Clear workspace**. This permanently clears that browser workspace’s records, cases, history and demo clock. **Do not reset between the discrepancy and correction steps below.**

| Step | What to do | What you should see |
| --- | --- | --- |
| 1. Matching records | Click **Demo guide → Load matching records**, then **Run reconciliation**. Open **Dashboard**. | **Passed**, a **Clear** position, $0 gap and no cases in a fresh workspace. |
| 2. A discrepancy | **Demo guide → Load $400 discrepancy → Run reconciliation**. Open Dashboard. | **Exceptions**, one $400 pooled gap, one flagged customer and three cases. The demonstration risk policy refers them immediately. |
| 3. Repeat the run | Run reconciliation again without replacing the records. | Another stored run, but still three cases, with no duplicate risk referrals. |
| 4. Investigate | Open **Exceptions → View** on a case. Assign **Alex Carter**, click **Start investigation**, enter a note and **Save note**. | Ownership and the note are saved. **Resolve exception** remains disabled until correction is verified and a reason is entered. |
| 5. Check deadlines | Close the case drawer. Open **Demo deadline clock → Advance 25 hours**, then close the clock window. | Three **Overdue** cases. Open a case to see elapsed overdue time. Existing escalations are retained; dates and financial amounts stay unchanged. |
| 6. Correct | **Demo guide → Load corrected records → Run reconciliation**. Open Dashboard. | **Passed**, Clear and $0 current gap. The cases remain open for documented closure. |
| 7. Close the case | Return to the assigned case, enter an **Escalation or resolution reason**, then click **Resolve exception**. | That case becomes **Resolved** and loses its active Overdue badge. Other cases require their own owners and resolution reasons. |
| 8. Check saving | Refresh the page. | Your records, run history, owner, notes and case status remain saved. |

Samples use **20 October 2026** even when today’s date is different. Loading a sample stages actual CSV records and preserves history; you must click **Run reconciliation** to calculate a manual result. An overall **Passed** result does not automatically close cases.

For broader testing, use the [groupmate testing checklist](docs/TESTING_GUIDE.md). For presentation wording, use the [short demo script](docs/DEMO_SCRIPT.md). The sections below explain the files, checks and advanced controls; [PLAN.md](PLAN.md) and [ROADMAP.md](ROADMAP.md) describe the project scope.

## What does LedgerWatch do?

LedgerWatch helps a bank analyst answer: **Do the bank’s records and its intermediary’s records agree, and is someone investigating when they do not?** An intermediary connects fintech applications with banking services and keeps records of customer balances and transactions.

You load synthetic CSV records, run reconciliation (compare the records), and investigate any differences or unusable evidence. The **Dashboard** summarises results, **Reconciliation** processes the files, and **Exceptions** records owners, investigation notes, escalation and resolution.

The project explores proposed controls relevant to our Evolve–Synapse case study. Its fictional bank and intermediary do not recreate their actual systems. It does not move money or establish who caused a real financial loss.

## What are the five CSV files?

An **FBO account** holds pooled funds “for benefit of” customers. The bank’s total balance and the records showing each customer’s share must be checked together.

| File | Plain-language meaning |
| --- | --- |
| `bank_balances.csv` | The bank’s opening and closing total for the pooled account. |
| `customer_opening_balances.csv` | The agreed starting balance for each expected customer. |
| `bank_transactions.csv` | Customer-linked deposits and withdrawals recorded by the bank. |
| `intermediary_transactions.csv` | The intermediary’s record of those customer transactions. |
| `intermediary_balances.csv` | The intermediary’s reported closing balance for each customer. |

**Load Sample Scenario** stages the complete bundle for you; manual uploads can replace individual files. The missing-feed scenario deliberately omits one file. All results are calculated from the records, not from the scenario name.

## What do the reconciliation checks mean?

| Check | Question it answers |
| --- | --- |
| Five source-availability checks | Is each required file present, valid and covering the selected business date? Older coverage is **Stale**; a missing or invalid source blocks dependent checks. |
| Opening baseline control | Do all customer starting balances add up to the bank’s opening total? |
| Bank movement consistency | Does the bank’s opening balance plus its recorded deposits/withdrawals equal its closing balance? |
| Aggregate balance reconciliation | Do the intermediary’s customer closing balances add up to the bank’s closing total? |
| Transaction-level reconciliation | Does each transaction appear on both sides with the same amount and customer? |
| Customer-level reconciliation | Does each customer’s opening balance plus bank-recorded movements equal their intermediary-reported closing balance? |
| Intermediary ledger consistency | Do the intermediary’s own transactions explain its reported customer closing balances? |

For example, a customer starting with **$1,000** and depositing **$500** should finish with **$1,500**. If the intermediary records a **$900** deposit and a **$1,900** closing balance, its own ledger is internally consistent, but comparison with the bank reveals the **$400** disagreement. Matching overall totals can also conceal money allocated to the wrong customer.

## How should I interpret the results?

| Overall outcome | Meaning and next action |
| --- | --- |
| **Passed** | All required checks completed without findings for these inputs. This does not prove the uploaded records are authentic or complete. |
| **Exceptions** | Checks completed but found discrepancies. Open the exception cases and investigate. |
| **Blocked** | At least one required check could not complete because evidence or a calculation was unusable. Restore/correct the evidence and rerun; other available checks may still show results. |

A **check** is a comparison; an **exception case** is a saved work item created from a finding. One underlying error can trigger multiple cases: the $400 sample produces aggregate, transaction and customer findings about overlapping evidence, **not a $1,200 loss**.

Results are grouped into **Source readiness** and **Financial agreement**. Failed checks appear first; information icons explain each financial check on hover or keyboard focus. Passing source checks are expandable. The run selector identifies manual versus monitoring runs and labels historical results. The Dashboard shows the current assessed position separately from stored results and live delivery health.

Assign an owner, record investigation notes, and escalate when needed. Critical source failures escalate immediately; other unresolved cases escalate after 24 deadline-clock hours. Phase 3 also refers current financial cases for management review when its assessed absolute gap reaches $250 or a transaction's customer allocation disagrees. These are demonstration policies. Resolve each case only after correcting the records, successfully rechecking the relevant business date, and entering a resolution note. A Passed run does not automatically close existing cases.

Each investigation includes a closure checklist. Expand **Source evidence at last detection** for readable financial fields, **Related investigations** for shared evidence/context, or **Evidence & activity history** for recorded actions. Supporting and verification links open the exact stored run. Raw JSON, scope identifiers and full timestamps remain available in expandable details. The checklist explains disabled resolution controls; it does not replace the enforced reconciliation safeguards. On mobile, cases appear as cards with a visible **View investigation** button.

Use **Filters** above the exception queue for priority and queue view, including Overdue, Unassigned and Ready to close. Applied filters appear in the button's count and a visible criteria summary; **Clear filters** resets them. Search remains available directly above the cases; **Clear search and filters** resets both.

## Start here for a presentation

Click **Demo guide** in the header. Its scenario cards explain what to demonstrate and load the actual five-file bundle. For a short presentation, use **Matching records → $400 discrepancy → Corrected records**. Run reconciliation after each load, then use Dashboard's next-action links to investigate. The guide also offers allocation/missing/stale examples and a missed-delivery demonstration.

The guide never supplies reconciliation results. Samples cover **20 October 2026**, and loading preserves cases/history. Use the confirmed **Reset workspace** action before a fresh presentation if you want an empty queue. See the short [demo script](docs/DEMO_SCRIPT.md) for what to say and show.

## Additional reconciliation scenarios

In **Reconciliation → Manual CSV records**, select a **Sample scenario**, click **Load Sample Scenario**, then **Run reconciliation**. Reset before each independent test for an empty case history.

| Scenario | Expected outcome |
| --- | --- |
| 04 · Customer allocation error | Exceptions: pooled totals match, but transaction/customer allocations disagree. |
| 05 · Missing intermediary feed | Blocked: the intermediary closing ledger is deliberately absent. |
| 06 · Stale intermediary feed | Blocked: the ledger covers the previous business date. |

Manual records and **Delivery monitoring** use separate snapshots; switching tabs does not delete either. See the [testing checklist](docs/TESTING_GUIDE.md) for upload, deadline and recovery tests.

### Finding the next case to work on

In **Exceptions**, an amber **Overdue** badge means an unresolved case has reached its investigation deadline. **Escalated** means the case was referred to Risk / Compliance; a risk referral can happen before the deadline. These flags are separate from Open / Investigating / Resolved. The **Overdue cases** card counts unresolved cases only. Open a case to see its deadline and elapsed overdue time, evaluated using the demo deadline clock and refreshed periodically. Resolving a case removes its active Overdue badge while preserving its deadline and activity history. Verification alone does not close the case or remove its overdue flag.

Use **Filters → Queue view** to find **Overdue**, **Unassigned**, or **Ready to close** cases. Ready to close means the correction has been verified and an owner assigned; you must still enter a resolution reason before resolving. **Clear search and filters** restores the full queue. The customer-balance rows identify whether the check compared the closing balance with bank transactions or intermediary transactions; these overlapping findings are not additional amounts of missing funds.

## Manual CSV uploads

Load a bundle as a starting point, then **click a source row** to reveal its CSV upload, coverage date, Inspect and Remove controls. One source opens at a time. Status, declared coverage and record count remain in the compact summary; validation errors remain visible when controls are collapsed. Inspect/download source files from **Inspect**. The selected business date is separate from each source’s declared coverage date. New manual uploads default their declared coverage to the selected business date; change it explicitly when needed. Row dates must agree with declared coverage. See [docs/CSV_CONTRACT.md](docs/CSV_CONTRACT.md) for the schema and limitations. Files must be smaller than 1 MB each.

**Editing dates in Excel:** Each expanded source has a **CSV date format** selector. Keep `YYYY-MM-DD` for the sample files. If Excel saves dates as `10/20/2026`, select **MM/DD/YYYY (month first)** before or after uploading. LedgerWatch normalises valid dates for its checks without changing the original CSV. For example, `01/02/2026` means **2 January** in month-first mode. Impossible dates, mixed formats and coverage mismatches still block reconciliation. The website’s coverage date picker may display a local date format independently. Monitoring has the same selector for the **next delivery**; re-upload that delivery after changing its format.

Every result uses the CSV contents. Sample IDs never determine reconciliation outcomes. Sample CSV files also live in `public/samples/` and can be uploaded manually.

In a real deployment, these five datasets would normally arrive through scheduled exports, secure file transfers or APIs rather than five uploads by an employee. They represent five logical sources of evidence, not necessarily five physical files. Staff would primarily investigate exceptions and resolve delivery failures. Those integrations are outside this browser-based prototype.

Selecting a replacement upload immediately makes that source unavailable while it is read. If reading fails or the file is 1 MB or larger, LedgerWatch shows an error and does not reuse the old file to produce a misleading Passed result. Late reads cannot overwrite a newer upload, loaded scenario, removed source or reset workspace.

## Phase 2: daily delivery monitoring

Phase 2 detects missing daily intermediary records **without requiring a transaction or a manual reconciliation run**. It monitors the intermediary transaction file and customer closing-balance file. Delivery health is separate from financial agreement: both sources can be **Received** while reconciliation reports **Exceptions**.

### First demonstration: missed delivery and recovery

1. Open **Reconciliation → Delivery monitoring**. Select **Missing delivery and recovery**, then click **Start monitoring demo**. This creates an independent synthetic bank snapshot and expects both intermediary sources within five simulated minutes. Manual uploads remain untouched.
2. Click **Next replay event** once. Intermediary transactions arrive; the closing ledger is still **Awaiting delivery**. No financial run is created from partial evidence.
3. Click **Next replay event** again. Simulated time reaches the deadline. The missing closing ledger becomes **Overdue**, and one critical delivery case is created and escalated automatically. Repeated timer checks do not duplicate it.
4. Open **Exceptions** and view the **Daily delivery failure** case. Assign an owner or save investigation notes. Resolution is blocked while recovery has not been verified.
5. Return to **Delivery monitoring**, then click **Next replay event**. The missing ledger arrives. The engine validates both sources and automatically reconciles the full monitored snapshot.
6. Expect **Delivery complete** and a **Passed** financial result. The case becomes eligible for resolution but stays open. Return to it, assign an owner if needed, enter a resolution reason and resolve it.

The expected business date in synthetic demos is **2026-10-20**; it is not determined by today's actual date. Receipt timestamps use actual system time, while the existing simulated clock drives deadlines. Replay steps advance that clock only forward. Advancing time yourself before delivery can make an otherwise on-time scenario late.

### Other scenarios and custom records

| Monitoring scenario | Expected behaviour |
| --- | --- |
| On-time delivery | Both sources arrive before the deadline; automatic reconciliation passes without delivery cases. |
| Invalid delivery and recovery | An invalid monetary value raises a delivery case immediately; corrected data is rechecked. |
| Stale delivery and recovery | Yesterday's ledger is not accepted for the expected business date. |
| Quiet day with zero transactions | A valid header-only transaction file counts as a received zero-activity delivery; unchanged balances reconcile. |
| Delivered records with a discrepancy | Delivery is complete, but the actual records produce a $400 financial discrepancy. |

To monitor your own synthetic records, first load/upload valid bank balances, customer opening balances and bank transactions in **Manual CSV records**. Switch tabs and click **Monitor staged bank records**. Upload both intermediary files using the **delivery** upload controls and declare their actual coverage dates. The copied bank context stays fixed for that monitoring window. Monitoring receipts never change the manual upload workspace.

Open **Window actions** for **Stop monitoring**, **Resume monitoring**, **Advance 5 minutes** and **Inspect monitored snapshot**. Stopping stops new delivery checks but retains investigations and does not freeze the shared clock. Resuming checks elapsed deadlines. Advancing five minutes demonstrates expiry without waiting. **Next replay event** remains visible as the main demo action. Loading a new monitoring demo keeps prior cases/history; it replaces the active monitor only. A new demo, replay step, stop or reset supersedes unfinished monitoring uploads so late reads cannot overwrite newer state.

### Monitoring policy and persistence

- Each window starts explicitly and covers one business date; there is no automatic midnight rollover. Five minutes is a demonstration policy, not a regulatory deadline.
- Missing evidence becomes Overdue at the deadline; stale or invalid receipts fail immediately. A receipt processed at the exact deadline is considered before evaluating that receipt's availability.
- Complete valid deliveries trigger real reconciliation. A failed delivery case needs both usable current sources and an automatic **Passed** snapshot before documented resolution. Manual-workspace runs cannot bypass that requirement.
- Monitoring is evaluated every 15 actual seconds while open, after receipt/clock changes and on reopening. There is no closed-browser service, real API, heartbeat system or pending-transaction grace period.
- Version-1 workspaces migrate to version 2 by adding inactive monitoring state. The existing browser storage key is retained so previous investigations, records and clocks are preserved. Damaged state is not silently overwritten.

See [Phase 2 implementation rules](docs/PHASE2_PLAN.md) for the policy and [Phase 2 verification](docs/PHASE2_VERIFICATION.md) for tests and limitations.

## Phase 3: current position and risk review

Dashboard answers **What is the position? Why does it need attention? What should I do next?**

| Indicator | Meaning |
| --- | --- |
| Current balance gap | Intermediary closing total minus bank closing balance, taken once from the selected aggregate check. Positive: ledger exceeds bank. Negative: bank exceeds ledger. Neither establishes a proven loss. |
| Customer records flagged | Unique customers implicated by detailed transaction/customer/ledger findings. Both sides of a customer allocation mismatch count; aggregate evidence alone does not mark every customer as affected. |
| Open cases / overdue actions | Administrative workload across business dates. These are separate from the current financial gap; corrected cases can remain open awaiting documented closure. |

The greatest reconciled business date takes priority, then the last run for that date. Replaying an older day cannot hide a newer discrepancy. Changed current inputs, a newer unprocessed date, incomplete deliveries or Blocked checks produce **Unknown / Not assessable**, rather than zero. Manual and monitoring snapshots remain separate, and the selected origin/date is visible.

**High** means an absolute pooled gap of **$250.00 or more**, or at least one transaction allocation mismatch. **Review** means other usable financial findings; **Clear** means all checks passed for those inputs. **Unknown** means the position cannot currently be assessed. The policy is explained under **How is this assessed?** and is a demonstration policy, not a regulatory threshold or overall bank risk rating. Original finding severity and the current position assessment are separate labels.

For a High position, current unresolved financial cases are referred to Risk / Compliance with the policy version, supporting run, actual timestamp and reason. Repeated evaluation, reloads and duplicate runs do not repeat a referral. Existing referrals remain intact. Recommendations link to real records or cases: obtain records, recheck, request management review, assign an owner or document verified closure. They never move money, freeze funds or restrict service.

The $400 scenario has three overlapping findings but one $400 pooled gap and one flagged customer. The allocation scenario has **$0 pooled gap** but customer discrepancies and a High review category. Correction clears the current gap while cases remain open. Replacing verified inputs revokes closure permission in the matching source context/date until a fresh successful applicable recheck.

Phase 3 uses the existing version-2 storage format/key with validated optional referral metadata. Previous workspaces remain loadable; qualifying existing cases may receive their first Phase 3 referral on reopening. See [Phase 3 rules](docs/PHASE3_PLAN.md) and [verification](docs/PHASE3_VERIFICATION.md).

## Tests and build

See [Phase 1 verification](docs/PHASE1_VERIFICATION.md) for the edge-case coverage and error-handling fixes verified on 22 October 2026.

The latest cleanup verification passed **194 unit/component tests**, the full **30-test Chrome browser suite**, and the production build. This includes the Excel date-format and overdue/queue usability updates. All 29 sample CSVs were checked against their generator, along with documentation links and source/CSS references. These are recorded results, not a guarantee for future changes. Earlier [Phase 3 verification](docs/PHASE3_VERIFICATION.md) documents the original phase audit and its historical test totals. Browser tests cover desktop, mobile and tablet workflows.

```powershell
npm.cmd test
npm.cmd run build
```

Browser acceptance tests use Playwright. Install its Chromium browser once if needed:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Alternatively, use installed Chrome:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
```

The browser suite starts/stops a local test server on port 4173. Test screenshots/traces are generated under ignored `test-results/`. Tests cover actual uploads, case investigation, separate clock behaviour, reload persistence, resolution safeguards, missing feeds and mobile layout.

To check the built static application, run `npm.cmd run build`, then `npm.cmd run test:production` (with the Chrome environment variable above if needed). This runs the complete matching → discrepancy → correction workflow against Vite preview on port 4174. It requires an existing `dist/` build and does not publish a site.

```powershell
npm.cmd run preview
```

Preview serves the production `dist/` build. The relative asset base and hash navigation allow eventual static hosting, including GitHub Pages. Upload the **contents of `dist/`** to your chosen static host. No site has been deployed. Use HTTPS on a public host for browser APIs such as `crypto.randomUUID()`.

## Sharing with groupmates

Share the **complete project source**, including `package.json`, `package-lock.json`, `index.html`, `vite.config.js`, `src/`, `public/`, `e2e/`, the Playwright configuration files, `scripts/`, README and `docs/`. Keep PLAN and ROADMAP for context. You can omit generated `node_modules/`, `dist/`, `test-results/`, `playwright-report/` and `coverage/` folders; each tester installs dependencies locally. Sharing only the README or source CSVs is not enough to run the app.

If sharing a repository link, check that the application files are committed and pushed to the branch you share. A local working folder can contain files that are not yet in the remote repository. Ask groupmates to start with **First time here? Start here**, then follow the [testing checklist](docs/TESTING_GUIDE.md). A local `127.0.0.1` URL refers to each person’s own computer; sending your local URL does not host the app for them.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `node` or `npm.cmd` is not recognised | Install Node.js with npm, reopen the terminal and check the versions. On macOS/Linux use `npm`. |
| npm cannot find `package.json` | Open a terminal in the extracted project folder containing that file, rather than its parent folder. |
| `npm ci` fails | Check the Node version and internet access, and confirm `package-lock.json` came with the project. Copy the actual error when asking for help; do not delete the lockfile to hide a mismatch. |
| Page will not open | Keep `npm.cmd run dev` running and use its printed URL. Vite can choose a different port when 5173 is busy. |
| Saved work seems missing | Check the browser and exact URL, including host and port. Private browsing and cleared site data do not retain the ordinary workspace. |
| Demo counts differ | Existing cases and an advanced clock survive sample loads. Reset before an independent test, but keep the workspace during discrepancy/correction tests. |
| Uploaded Excel dates are Invalid | Expand that source and select the format actually saved in the CSV. MM/DD/YYYY is month first; dates must still match declared coverage. Inspect lists errors. |
| A previous run says Passed but the Dashboard says Unknown | The inputs may have changed since that run, or a new monitoring window may be incomplete. Restore usable records and recheck the relevant workspace. A stored run is historical evidence, not a check of new uploads. |
| Resolve is disabled | Assign an owner, obtain a successful applicable correction recheck and enter a resolution reason. Delivery cases require recovery in Delivery monitoring. |
| A small discrepancy has High priority but the Dashboard says Review | Finding severity and current-position risk are different labels. The immediate pooled-gap referral threshold is $250; smaller unresolved cases still reach their investigation deadlines. |
| Browser tests cannot start | Install Playwright Chromium or select installed Chrome using the commands above. Test servers use ports 4173 and 4174. |

When reporting a bug, include the scenario, reset/clock history, exact steps, expected and actual outcome, and a screenshot. Include the synthetic CSV and selected format/coverage for import errors. Record the issue before resetting away its evidence.

## Known limitations

- One bank/account/partner, USD, daily posted activity and non-negative balances only. No pending transactions, fees, interest allocation, settlement tolerances or interbank sweeps.
- Customer-linked bank transactions and the agreed opening baseline are synthetic proposed controls, not statements about Evolve’s historical systems. Matching uploaded files cannot prove authenticity, completeness or legal entitlement.
- Storage is local to the browser and origin (including port), editable and quota-limited. No login, shared database, authenticated staff identities or tamper-proof logs. Storage errors are shown; if saving fails, current changes remain only in memory. Damaged storage is not overwritten automatically; reset deliberately to replace it.
- Retained run snapshots consume space over time. Reset after a demonstration if history is no longer needed; do not use this for real financial records.
- Escalation updates the app’s saved queue/history and sends no email. Deadlines are checked while open and on reopening, never in a closed-browser background service. The periodic check runs every 15 seconds.
- A corrected case stays open until an analyst resolves it. Rechecks apply only to matching scope/business date and cannot clear findings when required evidence is blocked.
- Fingerprints are non-cryptographic identifiers. Activity timestamps use the device system clock, which is not independently trusted.

Phases 1–3 are implemented. Phase 3 is the final planned release; the project remains local for review. The production build retains Vite's non-blocking main-chunk size warning.

## Assessment materials

The final hosted link, two-page maximum PDF guide and five-minute maximum backup video remain submission tasks after review/deployment. This README supplies launch and demo instructions, not the final PDF/video. Acknowledge AI assistance according to module requirements, and independently review the case analysis and implementation.
