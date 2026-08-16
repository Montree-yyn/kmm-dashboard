# KMM Enterprise Dashboard — Phase 1 Static Audit Report

- **Audit date:** 2026-08-15 (Asia/Bangkok)
- **Branch:** `feature/kai-phase1e-knowledge-layer`
- **Mode:** Repository + local environment only. No code changes, no commits, no deploys.
- **Note:** Working tree already contains pre-existing uncommitted changes (prior feature work). This audit reflects that state; nothing was modified by the audit.
- **Verification run:** `tsc --noEmit` ✅ clean (0 errors) · `npm run lint` ✅ 0 errors / 73 warnings · 50 regression test files present.

**Risk levels:** สูง (High) / กลาง (Medium) / ต่ำ (Low) · **Priority:** P0 = fix immediately, P1 = before next release, P2 = should fix.

---

## Summary of priorities

| # | Area | Finding | Risk | Priority |
|---|---|---|---|---|
| E1 | KPI/Metrics | Hardcoded "as-of" date (2026-07-11) in booking age | สูง | **P0** |
| E2 | KPI/Metrics | Product-type classification inconsistent across Sales/Booking/Stock | สูง | **P1** |
| E3 | KPI/Metrics | Target achievement not wired into Dashboard/Sales UI | สูง | **P1** |
| A1 | Architecture | Migration topology: 3 lineages + prod-commission divergence | สูง | **P1** |
| B1 | Database | `booking_transactions` / `stock_transactions` have no indexes | กลาง | **P1** |
| F1 | Governance | Environment schema divergence (prod vs staging vs local) | สูง | **P1** |
| A2–A5 | Architecture | Env parity, hardcoded business rules, client singleton, coarse RBAC | กลาง | P2 |
| B2–B5 | Database | TEXT money, no FKs, legacy duplicate columns | กลาง | P2 |
| C1–C5 | Modules | Huge pages, dual map engines, mixed dirs, dead code | กลาง | P2 |
| D1–D3 | Design | Token/doc drift, hardcoded colors, mixed-language strings | กลาง | P2 |
| E4–E6 | KPI/Metrics | Strict metric sums, stock filter semantics, legacy metrics | กลาง | P2 |
| F2–F3 | Governance | Partial freshness metadata, session-only Data Hub | กลาง | P2 |
| G1–G5 | Debt | Static fallback payload, debug logs, lint warnings | กลาง | P2 |

---

## 1. Architecture

### A1 — Migration topology: 3 lineages + prod divergence — Risk สูง — **P1**
- **Finding:** There are three independent migration lineages: `drizzle/` (0000–0011, mapped to `COMPANY_DB` in staging config but *also creates operations tables* — `sales_transactions`, `booking_transactions`, `stock_transactions`, `data_import_history`, `data_column_mappings`, even an ops index `0008_sales_invoice_lookup`), `drizzle/operations/` (0000–0040, mapped to `OPERATIONS_DB`), and `drizzle/production-commission/` (prod-only commission+aliases lineage using a separate `commission_prod_migrations` table). The prod-commission migration comment states it "deliberately does not mark or execute OPERATIONS_DB migrations 0007–0023".
- **Impact:** `COMPANY_DB` may contain stale/unused operations tables; production `OPERATIONS_DB` may be missing KAI knowledge tables (0007–0020) and agriculture tables (0024–0040, which the weather/agri baseline doc confirms are **local-only by design**). Unverified drift between environments makes data-level guarantees unclear.
- **Recommendation:** Produce an authoritative migration map: which migrations ran on which D1 database in each environment (`wrangler d1 migrations list` against prod/staging). Remove operations tables from the company lineage (or re-baseline), and publish a documented production rollout plan for KAI knowledge + agriculture before those features go live on prod.

### A2 — Prod vs staging environment parity — Risk กลาง — P2
- **Finding:** `wrangler.json` (prod) has no `MULTI_COMPANY_ENABLED` var (single-company KMM) and no `migrations_dir`; staging enables multi-company and pins migration dirs. KM (Kubota Maesod, Thailand) exists only in staging configs.
- **Impact:** Features validated on staging (multi-company, KM) may silently behave differently on prod; prod migrations are run out-of-band with no declared config.
- **Recommendation:** Add explicit vars and `migrations_dir` to the prod config with a documented apply procedure; make the multi-company flag explicit (`"true"`/`"false"`) in every environment.

### A3 — Business rules hardcoded in code — Risk กลาง — P2
- **Finding:** `capabilitiesForCompany()` hardcodes Marketing/Expense as KMM-only (`companyId === COMPANY_ID`); `enrichAuthorizedCompanies()` falls back currency/timezone by hardcoding `company.code === "KM"`. These rules duplicate data that already exists (`company_currencies`, `company_localizations`).
- **Recommendation:** Drive capability flags and defaults from company data (schema already supports it); keep the hardcoded branch only as a defensive fallback with a comment.

### A4 — Client company context as module singleton — Risk ต่ำ-กลาง — P2
- **Finding:** `lib/company-context/client-store.ts` keeps `activeCompany` in module-level mutable state. Safe in client-only usage; risky if ever imported into RSC/SSR paths (request bleed).
- **Recommendation:** Keep it strictly client-only (document), or migrate to React context/URL state.

### A5 — Coarse RBAC — Risk ต่ำ — P2
- **Finding:** 4 roles × 5 boolean permissions (view/edit/publish/disable/restore) with no module-level granularity; a viewer can view every module of an authorized company.
- **Recommendation:** Define a module×role capability matrix when new restricted surfaces (Data Hub write, company settings) expand.

### A6 — Strengths (verified)
- Hand-rolled Firebase JWT verification (RS256, `aud`/`iss`/`exp`/`iat` checks, JWKS caching with `max-age` respect) — solid and dependency-free on the server.
- Centralized `requireCompanyContext()` gate (token → membership → role permission → company scope) applied across API routes; `requestedCompanyId` regex-validated; multi-company off by default on prod.
- Cloudflare Workers entry (`worker/index.ts`) handles PMTiles range requests correctly (byte-range validation, 416 handling) and the basemap proxy retries once on 5xx.

---

## 2. Database Schema

### B1 — Missing indexes on Booking and Stock — Risk กลาง — **P1**
- **Finding:** `bookingTransactions` and `stockTransactions` define **no indexes**; `salesTransactions` has one scope index (`company, importYear, importMonth, invoiceNo`). Dashboard/executive queries filter by `companyId` + year/month + branch across full import volumes.
- **Recommendation:** Add compound indexes on `(companyId, importYear, importMonth)` and `(companyId, branch)` for booking and stock (cheap, safe, additive migrations).

### B2 — Money stored as TEXT — Risk กลาง — P2
- **Finding:** `sale_amount`, `gp1`, `final_received`, `net_received`, `expense`, `commission`, `target_value`, `booking_price`, `deposit_amount`, `msrp` are TEXT. Adapters normalize (including comma stripping), but there is no DB-level numeric integrity and mixed source formats can silently cast wrong.
- **Recommendation:** Standardize import normalization to numeric at ingestion; consider INTEGER minor-units columns for new tables; keep TEXT only with a documented canonical format + validator.

### B3 — No foreign keys / check constraints — Risk กลาง — P2
- **Finding:** No `.references()` anywhere; `status`, `product_type`, `approval_status`, `confidence_grade`, etc. are unconstrained TEXT. Integrity relies entirely on app + import validation.
- **Recommendation:** Acceptable for D1 speed today; add CHECK constraints / FK docs as a hardening migration and enforce enum values in the import validator (partially done in Data Hub).

### B4 — Legacy duplicate columns — Risk กลาง — P2
- **Finding:** Booking carries both `booking_no`/`booking_number`, `branch`/`branch_code`/`branch_name`, `status`/`booking_status`/`purchase_status`, `booking_year`/`import_year`; Stock carries `as_of_date`/`stock_date`/`snapshot_date`, `product`/`product_model`/`product_type`/`product_group`. Adapters pick one, but dual-column divergence is a standing data-hygiene risk.
- **Recommendation:** Add a data-quality job to detect and report columns where paired fields disagree; plan canonicalization when sources are stable.

### B5 — Opaque table-name concatenation — Risk ต่ำ — P2
- **Finding:** `dataImportHistory` uses `"data_" + "import_" + "history"`. Functional but unexplained; document the reason (tooling/workbook constraint) in a comment.

### B6 — Strengths (verified)
- `business_targets` is well-designed: empty-string dimension keys avoid NULL-unique ambiguity, exact-version unique index, `effectiveFrom` + runtime lookup index, read-only repository (`findApprovedTarget` never widens scope).
- Agriculture schema is provenance-rich (`agriSources`, `confidence_grade`, `verification_status`, `source_year`, `valid_from/to`, `agriDataGaps`).
- All tables carry `created_by`/`updated_by` audit columns; `audit_logs` table exists.

---

## 3. Module Structure

### C1 — Oversized page components — Risk กลาง — P2
- **Finding:** `marketing-intelligence-page.tsx` 4,001 lines; `dashboard-page.tsx` 1,607; `sales-page.tsx` 1,461; `myanmar-marketing-map*.tsx` ~1,200 each; `stock` 1,010. They mix data preparation, state, and presentation (also flagged in the V2 design audit).
- **Recommendation:** Extract data-prep selectors (many already exist) and presentational subcomponents; target page shells < 800 lines.

### C2 — Dual map engines (intentional fallback, high complexity) — Risk กลาง — P2
- **Finding:** `MyanmarMarketingMap` switches on `getMapEngine() === "maplibre"` to the new PMTiles implementation, falling back to the legacy GeoJSON map on load failure — with cross-imports and shared types between the two files.
- **Recommendation:** Keep, but isolate the fallback behind one adapter interface and add a test asserting fallback triggers only on load error.

### C3 — Parallel directory conventions — Risk กลาง — P2
- **Finding:** `app/` + `components/` + `lib/` coexist with `src/modules/`, `src/context/`, `src/hooks/`, `src/locales/`. Newer work (weather, agriculture) lives in `src/modules` while older surfaces live in `components/`.
- **Recommendation:** Define a migration target (e.g., feature slices under `src/modules/`) and move incrementally; at minimum document the intended boundary.

### C4 — Dead / half-wired code — Risk ต่ำ — P2
- **Finding:** `LegacyLineChart` + `void LegacyLineChart;` in `dashboard-page.tsx`; unused imports in `stock-intelligence-page.tsx` (`getAgedStock`, `getAverageStockAge`, `getStockValue`); `_onActiveMetricChange` accepted but voided in the maplibre map; `marketing: []` in dashboard data.
- **Recommendation:** Remove dead code; verify whether the dashboard "Recent Activity" surface has a live source (marketing rows are currently empty).

---

## 4. Design System

### D1 — Token vs DESIGN.md drift (two oranges) — Risk กลาง — P2
- **Finding:** DESIGN.md documents `--brand-500: #f56600` and canvas `#f6f6f3`; actual tokens are `#ff7a00` and `#f7f8fa`. Hardcoded `rgb(245 102 0)` (= `#f56600`) still appears in `.kmm-map-tool-button.is-active` and `.kmm-intelligence-action`. Two brand oranges are in active use.
- **Recommendation:** Pick one canonical orange, update DESIGN.md + GOLDEN_REFERENCE, and grep-replace the stragglers with the token.

### D2 — Incomplete token coverage — Risk กลาง — P2
- **Finding:** Many hardcoded hex colors remain in `globals.css` (township detail styles, presentation dock, map overlays: `#f8fafc`, `#374151`, `#c2410c`, `#d1d5db`, …) and in TSX arbitrary utilities (`text-[#4B5563]`, `border-[#E5E7EB]`, …). The V2 audit's "250+ arbitrary occurrences" finding still applies in part.
- **Recommendation:** Extend semantic tokens for remaining roles (debug surfaces, map overlays, info text) and migrate in the shared-component stage (Stage 2/3 of the V2 plan).

### D3 — Localization inconsistency — Risk กลาง — P2
- **Finding:** Several strings are hardcoded Thai outside the locale dictionaries: `waiting = "รอข้อมูล"`, `"มีข้อมูล"` in `myanmar-marketing-map.tsx`; KAI recommendations mix Thai (`executiveRecommendations`) and English (`recommendationsFor`). `src/locales/` has `en/th/my` dictionaries, but coverage is incomplete for these surfaces.
- **Recommendation:** Route all user-visible strings through `t()`; add missing keys to all three dictionaries; run a lint rule for hardcoded Thai/English literals in components.

### D4 — Strengths (verified)
- Strong token foundation (brand/surface/text/status/chart/space/radius/shadow/motion/font), Tailwind `@theme` mapping, `@supports` glass fallback, `prefers-reduced-motion` handling, 44px map controls, focus-ring system, `kmm-tabular` for numbers.

---

## 5. KPI / Metrics Definition

### E1 — Hardcoded "as-of" date in booking age — Risk สูง — **P0**
- **Finding:** `bookingAge()` defaults to `new Date("2026-07-11T00:00:00")` (`lib/dashboard/booking-selectors.ts`). `getAverageBookingAge` calls it without an `asOf`, so average booking age and anything downstream (attention panel, aging) are frozen at 2026-07-11 — already a month stale and growing.
- **Recommendation:** Thread the current date (or the latest data snapshot date) through callers; never default to a literal date. Add a regression test asserting age advances with an injected `asOf`.

### E2 — Product-type classification inconsistent across modules — Risk สูง — **P1**
- **Finding:** Three independent classification functions with different rules and different numeric codes:
  - Sales (`salesProductGroup`): exact type match, hyphenated codes `01-TT`, `02-CH`, `03-TP`, `04-EX`, `06-IM`, `07-IMO`, `08-OT`.
  - Booking (`normalizeBookingProduct`): alias map EX=`04EX`, TP=`03TP`, MAX=`05MAX` (no hyphen).
  - Stock (`normalizeProductType`): alias map EX=`03EX`, TP=`04TP`, MAX=`05MAX`, IM=`06IM`…; plus model-text fallback.
  - `productCategory()` (product-groups): substring match on `type + model`.
  - The numeric codes for EX and TP differ between Booking and Stock; a value such as `04-EX` classifies EX in Sales/Booking but falls to model-fallback (often `Unknown`) in Stock. Cross-module product breakdowns (executive dashboard, KAI) can therefore disagree.
- **Recommendation:** Create one canonical product-classification module (code table + alias map + no-model rule), use it in all four surfaces, and add a parity test asserting identical classification across Sales/Booking/Stock fixtures.

### E3 — Target achievement not wired into Dashboard/Sales UI — Risk สูง — **P1**
- **Finding:** `businessTargets` exists, `findApprovedTarget` works, and KAI consumes targets — but the executive dashboard passes `plan: { year: 0, … }` ("Sales targets are not yet supplied by the Dashboard API") and the Sales page returns `Target data is not available in Sprint 2.2`. DESIGN.md claims a bullet chart with an explicit target marker.
- **Impact:** Approved company targets are invisible in the primary UI; the design spec and the implementation disagree.
- **Recommendation:** Wire the dashboard/sales target surfaces to `getCompanyMonthlyTarget` (respecting the full-month-only rule already enforced by KAI); update DESIGN.md or the code, whichever is authoritative.

### E4 — All-or-nothing metric sums — Risk กลาง — P2
- **Finding:** `completeMetricSum` returns `null` (KPI shows "Unavailable") if *any* row lacks the value. Honest, but a single missing `gp1` blanks Gross Profit across the whole scope.
- **Recommendation:** Keep honesty but surface coverage ("GP available for 94% of rows") so operators can distinguish missing-data from real zero.

### E5 — Stock year/month filter semantics — Risk กลาง — P2
- **Finding:** Stock rows carry `year`/`month` from `importYear`/`importMonth` (import period), not the snapshot `as_of_date`; `filterStockRows` also lets rows with `undefined` year pass. Point-in-time snapshots can be filtered by the wrong period.
- **Recommendation:** Decide and document whether stock filters mean "as-of period" or "import period"; normalize to snapshot date and require year presence.

### E6 — Fragile string-based health parsing — Risk ต่ำ — P2
- **Finding:** Dashboard `stockAgeBand`/`stockHealthTone` regex-parse `ageBucket` strings (`/91|90\+|over\s*90/`), while `getAgedStock` uses numeric `ageDays > 90`. Two aging representations risk divergence.
- **Recommendation:** Compute health from numeric `ageDays` everywhere; keep the bucket string display-only.

### E7 — Strengths (verified)
- KAI executive intelligence is evidence-first: `EXECUTIVE_THRESHOLDS` constants, `canEvaluateFullPeriodTarget` (targets only for completed months), explicit non-causal wording, explainable weighted ranking, "Raw rows never reach Qwen", Fact Lock in narrative. YoY gating (exactly one year) and `N/A` honesty are implemented per DESIGN.md.

---

## 6. Data Governance Foundation

### F1 — Environment schema divergence risk — Risk สูง — **P1**
- **Finding:** (Detail in A1.) Production commission lineage explicitly skips ops migrations 0007–0023; agriculture migrations 0024–0040 are local-only per the weather baseline doc. Prod may be missing KAI knowledge tables and all agri tables.
- **Recommendation:** Reconcile and document actual deployed schema per environment before enabling KAI knowledge-layer or agriculture on prod; add a schema-drift check to the release pipeline.

### F2 — Partial freshness metadata — Risk กลาง — P2
- **Finding:** `fetchedAt`/cache age exist for weather and `sourceUpdatedAt` for sales; booking/stock and agriculture sources lack per-source run/valid timestamps (weather audit doc reached the same conclusion).
- **Recommendation:** Extend `dataImportHistory` with per-source validity windows and surface the oldest/weakest freshness link on the dashboard attention panel.

### F3 — Data Hub is session-only (v1.2) — Risk กลาง — P2
- **Finding:** Documented: imports are session-only, rollback is a future state, and there is no persistent approval ownership. Multi-user enterprise operation currently has no durable import audit beyond `dataImportHistory` rows.
- **Recommendation:** Keep the honest status, but prioritize the persistent import service (the `import-service.ts` boundary already anticipates it); gate destructive "replace" imports behind the existing append guard.

### F4 — Strengths (verified)
- Data-driven source registry (`source-definitions.ts`) with per-field type/required and duplicate keys; validation lifecycle `Ready → … → Success/Failed` with failed-row report; `dataColumnMappings` persisted per company+module; `sales-incremental` append guard; `audit_logs` table; multi-company isolation enforced at query time via `requireCompanyContext()`.

---

## 7. Technical Debt

### G1 — Shipped static fallback payloads — Risk กลาง — P2
- **Finding:** `public/dashboard-data.json` (1.8 MB), `public/kmm-real-data.json`, `public/data-import-report.json` are served as static assets. The fallback path is env-gated (`NEXT_PUBLIC_OPERATIONS_LOCAL_FALLBACK !== "true"` → disabled in production builds), but the payload still ships to every client.
- **Recommendation:** Move these out of `public/` (or exclude from the prod asset build) once D1 is the proven path.

### G2 — Debug logging — Risk ต่ำ — P2
- **Finding:** `console.log` in map components is dev-gated (acceptable); `console.warn` in KAI routes / Tavily provider is production logging (fine, but confirm no sensitive data).

### G3 — Lint warnings — Risk ต่ำ — P2
- **Finding:** 73 warnings, 0 errors: unused vars (`stock` page imports, `runtime-query-v2` `_sales`/`_booking`), React hooks missing deps (`stock`, `team`), `no-img-element` (company settings).
- **Recommendation:** Clear unused imports/deps warnings; adopt `next/image` where LCP matters.

### G4 — Deprecated/legacy markers — Risk ต่ำ — P2
- **Finding:** `getValidStockRows` deprecated alias; `getSalesAsp` explicitly "under review"; `KAI_DEFAULT_MODEL` legacy compat constant; `void LegacyLineChart;`.
- **Recommendation:** Schedule removal or ownership assignment for each marked item.

### G5 — Strengths (verified)
- Zero `@ts-ignore`/`@ts-expect-error`; strict typecheck passes; 50 regression test files covering multi-company isolation, data-hub flows, KAI phases, commission reconciliation, design regressions, weather/agriculture, localization — an unusually strong test baseline.

---

## Out of scope for Phase 1 (needs runtime/production access)

- Actual deployed D1 schema verification (needs `wrangler d1` access) — blocking for A1/F1 confirmation.
- Runtime performance measurement (Core Web Vitals, D1 latency) — needs staging/prod + load env.
- Security penetration testing beyond static review (auth logic is static-reviewed; live testing needs accounts).
- Mobile visual QA at 375px / cross-role UAT (needs device + test accounts; gate tracked in `docs/multi-company/pending-approval.md`).
- KAI LLM output-quality evaluation (needs live AI binding).
