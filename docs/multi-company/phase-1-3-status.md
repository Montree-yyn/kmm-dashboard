# Multi-Company Phase 1-3 Status

> Continued in `docs/multi-company/phase-4-8-status.md`.

Completed: 2026-08-11

Implementation branch: `feature/multi-company-phase-0-3`

Scope: select one authorized company at a time; no all-company or comparison view

## Deployment boundary

- Staging worker: `kmm-executive-dashboard-staging`
- Staging URL: <https://kmm-executive-dashboard-staging.kmm-dashboard.workers.dev>
- Staging version: `8424adeb-346a-4bac-95f9-6f64f907e81d`
- Production migration: not run
- Production seed: not run
- Production deployment: not run
- Production data mutation: none

## Phase 1: company isolation foundation

- Added one server-side company-context policy for authentication, membership,
  role checks, company selection, and disabled-company handling.
- Company selection accepts only an authorized company ID. There is no `all`
  company scope and no comparison path.
- Multi-company selection is enabled only in the staging configuration.
  Production remains locked to KMM while the flag is absent.
- Sales, Booking, Stock, Daily Management, Data Hub, KAI, and Company Settings
  resolve company access before company-scoped reads or writes.
- Repositories require an explicit company ID instead of silently defaulting to
  KMM.

## Phase 2: KM master and membership

- Added KM (`km-company`, tenant `km`) alongside KMM in the staging company
  database.
- KM defaults are THB, Thai, and `Asia/Bangkok`; KMM remains MMK and
  `Asia/Yangon`.
- Added a unique database index for `companies.company_id` on staging.
- Copied the existing staging KMM super-admin membership to KM. No other user
  was automatically granted access.
- Company Settings now reads and writes the selected authorized company.
- KM branches were intentionally not fabricated; KM currently has zero branches.

## Phase 3: company-scoped APIs and import

- Operational APIs and import replacement logic use the selected authorized
  company for every query, delete, insert, and import-history record.
- Data Hub lists only companies the signed-in user can access and resets pending
  files/history when the company changes.
- View-only users cannot import.
- Daily Management branch validation uses the selected company's active branch
  master.
- KAI accepts company context but does not expose a cross-company query mode.

## Verification

- Full build and regression suite: 270 passed, 0 failed.
- TypeScript check: passed.
- Staging smoke test: `/login` returned 200; unauthenticated
  `/api/company-context` returned 401.
- Staging company master: KM 1 membership / 0 branches; KMM 1 membership / 3
  branches. Each company has one currency and one localization record.
- Staging operational data remains KMM-only: Sales 4, Booking 3, Stock 4. No KM
  operational data was fabricated.
- Production values still match the Phase 0 baseline, and all verification
  queries reported zero rows written.

## Not ready yet

This is the isolation foundation, not a complete KM dashboard rollout. A global
company selector is not yet connected to every dashboard page, KM has no branch
master or operational data, and authenticated role-based UAT is still required.
Do not migrate or deploy this to production until those items pass in staging.
