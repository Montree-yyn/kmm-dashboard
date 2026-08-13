# Worker v39 baseline audit

Status: `V39_PROVENANCE_CONFIRMED`

Production Worker version 39 (`435ca02a-6c7a-44e4-95b9-45eb937dfabb`) was built from Git commit `a009ff7a15927b25df6f82565a93c6820e05bb31` (tree `63b17accfca786f43192b32a6b812f23bcbf9d72`). This commit is the canonical reproducible Worker v39 source baseline.

## Direct evidence

- The live immutable asset `marketing-intelligence-page-BYUpQopU.js` embeds commit `a009ff7a15927b25df6f82565a93c6820e05bb31` and build timestamp `2026-08-11T07:32:08.050Z`.
- `vite.config.ts` at that commit obtains the embedded commit from `git rev-parse HEAD`.
- Worker v39 was uploaded at `2026-08-11T07:32:36.705047Z`, 28 seconds after that build timestamp, and deployed at `2026-08-11T07:32:38.431642Z`.
- Local Wrangler log `/Users/CAKE/.wrangler/logs/wrangler-2026-08-11_07-32-27_255.log` records the same workspace, Production bindings, URL and Worker version ID. Its SHA-256 is `e44383de51bef3a90f646b9849612cba307b4a5a3b35d1749faa56fb5e2c4939`.
- A clean rebuild matched 77 of 79 normalized client chunks. The two remaining chunks contain build-time/timestamp-dependent output; the live marketing chunk itself contains the direct commit proof.
- The Daily Management input chunk matches `a009ff7`, not parent commit `72dd25d`.

Git cannot reconstruct the exact `git status` from deployment time. No material source divergence was found in the deployed asset graph or behavior.

## Feature comparison

| Feature | v1.1.0 (`475ac0f`) | Canonical `a009ff7` | Production v39 | Conclusion |
| --- | --- | --- | --- | --- |
| Daily Management | Earlier date, branch and edit rules | Governed company/role access, canonical date/branch and stock identity | Matching page/API chunks; unauthorized API returns 401 | v39 contains the governed implementation |
| Weather | Absent | Absent | Route/API return 404 | Post-v39 feature |
| KAI | Existing authenticated chat | Adds canonical stock-breakdown routing | Matching KAI route and bundle footprint | v39 includes the `a009ff7` fix |
| Sales Organization | Present; Commission unavailable | Same | Matching page chunk; Commission remains unavailable | No Commission deployment |
| Authentication | Firebase and protected APIs | Same, plus governed Daily Management access | Login loads; protected APIs return 401 without a token | Guard behavior matches |
| Data Hub | Existing import flow | Adds canonical stock physical-identifier validation | Matching route/chunk footprint | Reproducible from `a009ff7` |
| Dashboard source safety | Authenticated APIs and D1; no static fallback | Same | Matching API-only behavior | Source safety preserved |

## Production baseline recheck

- URL: `https://kmm-executive-dashboard.kmm-dashboard.workers.dev`
- Active deployment: `ddb7e685-0dbb-47e8-a623-875640472041`, v39 at 100% traffic
- Bindings: exact Production `COMPANY_DB` and `OPERATIONS_DB`, AI, assets, KAI variables and Tavily secret
- Rows: Sales 3,376; Booking 398; Stock 748; Salespeople 18; Targets 72
- July 2026: 43 units; Sales Value 6,037,455,550 MMK; GP 172,329,790 MMK
- Public application routes return 200; protected APIs return 401 without authentication as expected
- Authenticated UI/API smoke was not performed because no application user token was available

All D1 checks were read-only and reported zero rows written.

## Validation

The canonical commit was checked in a detached clean worktree:

- TypeScript: PASS
- Lint: PASS (0 errors, 72 pre-existing warnings)
- Build: PASS
- Regression: 261/261 PASS
- Git diff check: PASS

The commit's registered Target test referenced `scripts/import-local-targets.mjs`, which was not tracked until a later commit. The full regression was therefore run with that test-only fixture supplied externally; no Production source file was changed.

## Decision and rollback

No corrective deployment was made. Replacing a proven, healthy Worker would add risk without improving reproducibility. Worker v38 (`94f912fa-1a42-4a8d-b573-10711ea5096c`) remains available as the prior rollback version.

Production D1: `UNCHANGED`

Commission: `NOT DEPLOYED YET`
