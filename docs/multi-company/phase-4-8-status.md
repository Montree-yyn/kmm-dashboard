# Multi-Company Phase 4-8 Status

Updated: 2026-08-12

Current integration branch: `feature/kai-phase1e-knowledge-layer`

Scope: one authorized company at a time; no all-company or comparison view

## Executive status

The multi-company application path is deployed to staging, but the KM data
rollout is intentionally blocked. KM has no approved Branch Master and no
authoritative Sales, Booking, or Stock files. The application therefore allows
local file selection and validation while preventing any KM D1 import.

Production was not migrated, seeded, deployed, or written to.

## Phase 4: KM data onboarding

Status: workflow ready; data onboarding blocked by missing business inputs.

- Added a `KM Data Onboarding` drilldown in Data Hub for Sales, Booking, and
  Stock.
- Each module has a direct file picker and latest-import state.
- Selecting a file parses, maps, validates, and previews it locally. It does
  not upload or persist the file.
- D1 writes require an explicit `Approve & import` action, edit permission, a
  valid period, and at least one active branch in the selected company's
  Branch Master.
- The server accepts approved branch codes or names and rejects blank,
  cross-company, and unknown branch values before replacement begins.
- Saved mappings and import history are company-scoped.
- No KM operational rows or synthetic branch records were created.

Required business inputs:

1. Approve KM branch codes and names.
2. Create the active KM Branch Master.
3. Supply authoritative Sales, Booking, and Stock workbooks.
4. Confirm that a KM Sales workbook is a full replacement dataset, because the
   existing governed Sales import contract replaces the company's current
   Sales dataset.
5. Confirm the KM Stock ownership rule. Until a dedicated ownership field is
   approved, KM uses company isolation plus `Free Stock`; KMM retains its
   existing `KMM = 1` plus `Free Stock` rule.

## Phase 5: single-company switcher

Status: deployed to staging.

- The header lists only companies granted to the signed-in user.
- There is no `All companies` option and no comparison view.
- The selected company is persisted per user.
- A switch remounts the page and KAI surfaces so filters, chat history, and
  in-memory data cannot carry into the next company.
- Existing `companyId` deep links are updated when the user switches company.

## Phase 6: company-aware shared modules

Status: deployed to staging.

- Dashboard, Sales, Booking, Stock, Team, Daily Management, Data Hub, Company
  Settings, and KAI pass an explicit selected company ID to server APIs.
- Company name, code, currency, timezone, branches, and export filenames come
  from company context.
- Local KMM fallback files are rejected when KM is active, including local QA
  failure paths.
- Booking and Team branch lists are derived from active company data and Branch
  Master records instead of fixed KMM branch arrays.
- Daily Management browser drafts are company-scoped. Only KMM can read its
  legacy unscoped browser draft for backward compatibility.
- KAI uses the selected company's currency and timezone for shared aggregate
  answers and remains aggregate-only/read-only.

## Phase 7: unsupported-module containment

Status: deployed to staging.

- Marketing and Expense remain KMM-only because KM has no verified source or
  geography model.
- Those menu items are hidden for KM.
- Direct navigation is guarded before the KMM page component mounts and
  redirects the operator toward Dashboard or Data Hub.

Known blocker: `public/dashboard-data.json` remains a legacy KMM asset from the
current architecture. Runtime operational clients cannot use it for KM, but it
should be removed or placed behind authenticated access before a production
multi-company rollout if the source is confidential.

## Phase 8: verification and rollout

Status: automated local and staging verification passed; authenticated role UAT pending.

- Full build and regression suite: 311 passed, 0 failed.
- Multi-company targeted suite: 93 passed, 0 failed.
- TypeScript: passed.
- Lint: passed with no errors; the repository retains pre-existing warnings.
- Release gate: 11 of 11 checks passed.
- UI quality detector: no findings.
- Current local candidate release gate: 11 of 11 checks passed on 2026-08-12.
- Staging `/login`: HTTP 200.
- Unauthenticated staging `/api/company-context`: HTTP 401.
- Staging `/data-hub`: HTTP 200 and redirects unauthenticated browser sessions
  to the login route.
- Browser-based authenticated UAT could not be completed because the available
  browser session had no staging login. No credentials were requested or used.

### Staging deployment

- Worker: `kmm-executive-dashboard-staging`
- URL: <https://kmm-executive-dashboard-staging.kmm-dashboard.workers.dev>
- Current version: `9a19f53a-bad1-4ac3-a9c7-2c2de2a047a9`
- Previous known version: `8424adeb-346a-4bac-95f9-6f64f907e81d`

### Post-deploy staging data check

All verification queries reported zero rows written.

| Company | Active branches | Active members | Sales | Booking | Stock |
|---|---:|---:|---:|---:|---:|
| KM | 0 | 1 | 0 | 0 | 0 |
| KMM | 3 | 1 | 4 | 3 | 4 |

The small KMM counts above are staging fixtures, not the production baseline.

### Production read-only recheck

The production KMM baseline still matches Phase 0: 1 company, 1 company user,
3 branches, 3,376 Sales rows, 398 Booking rows, 748 Stock rows, 18 salesperson
master rows, and 72 approved target rows. Cloudflare reported zero rows written.

## Production rollout decision

Decision: **not ready for production**.

Production rollout remains blocked until all of the following pass:

1. KM Branch Master is approved and configured.
2. KM Sales, Booking, and Stock files are reconciled to signed source totals.
3. KM Stock ownership semantics are approved.
4. Admin, manager, and viewer UAT confirms company switching, route guards,
   import permissions, empty states, and zero cross-company leakage.
5. The legacy static KMM asset risk is accepted or remediated.
6. The Phase 0 production KMM baseline is rechecked immediately before and
   after rollout.
7. A staging rollback to the previous worker version is rehearsed.

The exact approval checklist is maintained in
`docs/multi-company/pending-approval.md`. Source code, migrations, and dry-run
scripts may be versioned before these approvals; they must not be executed
against production until every required item is approved.
