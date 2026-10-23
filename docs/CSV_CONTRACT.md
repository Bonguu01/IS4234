# Phase 1 CSV contract

All five files use headers and UTF-8 CSV. Papa Parse handles quoted fields and standard CSV escaping. IDs are trimmed strings. Monetary cells use decimal strings (e.g. `1000.00`, `-0.25`) without currency symbols, commas or scientific notation; at most two decimal places. Calculations and comparisons use integer cents, with safe-range checks including sums/differences.

Required shared columns on every record:

| Column | Phase 1 value |
| --- | --- |
| `bank_id` | `BANK-001` |
| `partner_id` | `PARTNER-001` |
| `fbo_account_id` | `FBO-001` |
| `currency` | `USD` |
| `business_date` | Valid date in the selected CSV format, normalised to `YYYY-MM-DD` and matching the source’s declared coverage |

| File | Additional columns | Cardinality |
| --- | --- | --- |
| `bank_balances.csv` | `opening_balance`, `closing_balance` | Exactly one row |
| `customer_opening_balances.csv` | `customer_id`, `opening_balance` | One row per expected customer; at least one |
| `bank_transactions.csv` | `transaction_ref`, `customer_id`, `amount` | Unique reference per scope/date; may be header-only |
| `intermediary_transactions.csv` | `transaction_ref`, `customer_id`, `amount` | Same rules as bank transactions |
| `intermediary_balances.csv` | `customer_id`, `closing_balance` | One row per expected customer; at least one |

All transaction/customer references must exist in the customer opening roster. A missing customer closing balance is detected as a missing-record finding rather than treated as zero. Duplicate balance/customer/transaction keys invalidate the respective source. Non-negative balances are required; signed transactions represent posted credits/debits. Unknown extra columns are not used in calculations.

Each source has an explicit **CSV date format** selector. The default is `YYYY-MM-DD`; select `MM/DD/YYYY (month first)` for Excel exports such as `10/20/2026`. One-digit months/days such as `1/2/2026` are also accepted in month-first mode and mean 2 January, never 1 February. Two-digit years, impossible dates, day-first slash dates and mixed formats within one file are rejected. Dates are never guessed. Sample/downloaded sample files use ISO dates. Inspect/download preserves the original uploaded CSV, while validated rows and financial checks use normalised ISO dates. The selected interpretation is persisted with the source and stored runs. Changing it requires a new reconciliation check before affected cases can be resolved. Monitoring delivery selectors apply to the next uploaded delivery; re-upload to replace existing evidence with a different interpretation.

The import panel stores a declared coverage date even for a valid header-only transaction source. The browser may display its date picker as `10/20/2026`; this display does not set the CSV format. File modification time and upload time are not treated as coverage dates. Coverage earlier than the reconciliation date is stale; coverage later than that date is invalid. The demo deadline clock has no role in this decision.

The daily opening customer balances must sum to the bank opening balance. Customer reconstruction is blocked if that baseline fails. All funds belong to the sole FBO account. This deliberately excludes fees, interest, operational money, overdrafts, in-flight settlement and cross-bank sweeps.

The `matching`, `difference` and `corrected` bundles share business date **2026-10-20**. Matching records contain $3,000 opening funds, a $500 credit and a $100 debit, producing a $3,400 close. The difference bundle overstates the intermediary credit and corresponding customer balance by $400; this is processed input data, not a hardcoded result. Changing the CSV changes the result.

The missing bundle omits `intermediary_balances.csv` deliberately. The stale bundle supplies that file for **2026-10-19**. Neither can establish successful reconciliation for 2026-10-20.

Northstar Bank and Bridgeway Technologies are fictional. The bank customer linkage and opening baseline are proposed control improvements for synthetic demonstrations, not historical claims about Evolve or Synapse.
