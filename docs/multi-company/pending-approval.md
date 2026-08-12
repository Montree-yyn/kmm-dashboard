# Multi-Company Pending Approval

Updated: 2026-08-12

Scope: production rollout only; committing source code does not authorize any action below

## Business data approval

- [ ] Approve the official KM branch codes and branch names.
- [ ] Create and verify the active KM Branch Master.
- [ ] Supply authoritative KM Sales, Booking, and Stock workbooks.
- [ ] Reconcile KM source row counts, units, values, and reporting periods to signed business totals.
- [ ] Confirm that KM Sales import may use the governed full-replacement contract.
- [ ] Approve KM Stock ownership semantics and the exact definition of current/free stock.

## Access and UAT approval

- [ ] Run authenticated Admin, Manager, and Viewer UAT in staging.
- [ ] Verify company switching, route guards, import permissions, empty states, and zero cross-company leakage.
- [ ] Complete 375px mobile UAT for Dashboard, Sales, Booking, Stock, Data Hub, KAI, and Weather.
- [ ] Confirm that KM-only empty states and unavailable KMM-only modules use approved business language.

## Production approval

- [ ] Accept or remediate the legacy `public/dashboard-data.json` KMM asset risk.
- [ ] Recheck the Phase 0 KMM production baseline immediately before rollout.
- [ ] Approve production company and operations migrations.
- [ ] Approve production KM seed and company-switching feature flag.
- [ ] Rehearse staging rollback to the previous Worker version.
- [ ] Approve production deployment and post-deploy KMM/KM reconciliation.

Until all required items are checked, do not run production migrations, seed
KM production data, enable production multi-company switching, or deploy this
candidate to production.
