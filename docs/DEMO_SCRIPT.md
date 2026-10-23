# LedgerWatch: a short demonstration

Use the in-app **Demo guide** to load each bundle, then click **Run reconciliation**. Start with a fresh workspace if you want an empty history; reset requires confirmation. The fictional data covers **20 October 2026**. The guide explains expected outcomes; the application calculates actual outcomes from CSV contents.

## 1. Establish the baseline (about 30 seconds)

Load **Matching records**, run checks, then open Dashboard.

Say: “We compare the pooled bank account with the intermediary's customer records. These records agree: the reconciliation passes, and the current balance gap is zero.”

Show: Passed financial checks, Clear position, and the information icons if a check needs explanation. Five sources cover the bank total, agreed customer opening balances, both transaction lists and intermediary closing balances.

## 2. Detect and investigate a difference (about 90 seconds)

Load **$400 discrepancy**, run checks and open Dashboard.

Say: “The intermediary records a $900 deposit where the bank records $500. Three checks notice the same error. LedgerWatch shows one $400 pooled gap, not a $1,200 loss. One customer record is flagged. Our demo policy refers gaps of at least $250 for review.”

Open **Review with Risk / Compliance**. The recommendation prefers the transaction case. Assign an owner, start investigation and save a short note. Expand **Source evidence at last detection** to show the $500/$900 records. Expand related investigations or the referral reason if needed. Resolution remains unavailable until correction is verified.

## 3. Correct and close (about 60 seconds)

Load **Corrected records**, run checks, then open Dashboard.

Say: “The current difference is now zero, but the investigation remains open. A corrected financial position and an administratively closed case are different controls.”

Open **Document verified closure**, enter a resolution reason and resolve that case. Each remaining case retains its own owner/note requirements. Supporting-run links preserve the evidence trail; replacing corrected evidence requires a new recheck.

## 4. Optional: demonstrate a different failure (about 60 seconds)

- **Customer allocation error:** pooled totals match, but the wrong customer is credited. Two customer records are flagged; zero pooled gap does not establish correct allocations.
- **Missing or stale feed:** financial position is Not assessable, not zero risk. Restore valid records and recheck.
- **Missed delivery:** start it from Demo guide and click Next replay event three times: transaction delivery → missed ledger deadline/case → delivery and automatic recheck. Investigations remain open until documented closure.

Close with: “These are proposed governance and reconciliation controls using synthetic records. This is not a reconstruction of Evolve's actual systems, a determination of customer entitlement or an explanation of Synapse's bankruptcy. All actions and storage are local; no funds move.”

The in-app guide and this script are presentation aids. The required two-page maximum PDF prototype guide and backup video remain separate submission materials.
