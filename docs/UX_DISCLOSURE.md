# Progressive disclosure in LedgerWatch

Show the information needed for the current decision; reveal detailed controls where the user asks for them. Keep errors, financial outcomes and primary actions easy to find.

| Area | Always visible | Revealed on demand |
| --- | --- | --- |
| Source preparation | Five source names, status, coverage/count summary, validation errors, scenario loader and Run reconciliation | Click a source row for upload, coverage editing, Inspect and Remove; one row opens at a time |
| Monitoring | Delivery health, deadlines, financial recheck and Next replay event | Window actions menu: advance time, stop/resume and inspect the monitored snapshot |
| Exception queue | Search, cases and Filters button | Priority/status dropdown panel; applied criteria remain visible through the active count and summary; Clear filters restores all criteria |
| Dashboard | Current position, risk reason, indicators and next steps | Policy explanation, source coverage and activity |
| Investigation | Case status, assignment, notes, correction gate and resolution requirements | Related evidence, detailed referral reason, timestamps, technical records and full history |

Menus group secondary actions rather than concealing financial results or validation failures. Opening/closing a disclosure does not change financial records or create audit activity. Filters affect the queue view, not stored cases. Keyboard controls, Escape dismissal and mobile placement are exercised in browser tests. Existing sample loading, manual upload, reconciliation, investigation, escalation and persistence checks are retained.

The redundant three-step source-preparation banner was removed; the Demo guide provides the walkthrough. The screens remain Dashboard, Reconciliation and Exceptions. No business rules or additional development phase were introduced.
