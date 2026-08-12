# Multi-Company Phase 0 Baseline

Captured: 2026-08-11

Source commit: `fcd90087c8c0c99d426ab9990ea11357a3f172b7`

Implementation branch: `feature/multi-company-phase-0-3`

No production rows were written while collecting this baseline. Cloudflare D1
reported `rows_written: 0` for every query.

## Production KMM baseline

| Scope | Baseline |
|---|---:|
| Companies | 1 |
| Company users | 1 |
| Branches | 3 |
| Sales rows | 3,376 |
| Sales first / last date | 2021-10-13 / 2026-07-31 |
| Sales units | 3,376 |
| Sales value | 222,905,609,524 |
| GP1 | 20,839,858,522 |
| Booking rows | 398 |
| Stock rows | 748 |
| Salesperson master rows | 18 |
| Approved target rows | 72 |
| Daily management input rows | 0 |

## Baseline verification

- TypeScript: passed
- Targeted regression tests: 47 passed, 0 failed
- Production deployment: not run
- Production migration: not run
- Production data mutation: none

Before any production rollout, repeat these queries and compare the KMM values.
The rollout must stop if KMM row counts or approved KPI totals change without an
explicitly approved KMM data update.
