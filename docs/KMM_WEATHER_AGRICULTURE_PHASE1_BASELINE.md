# KMM Weather & Agriculture Phase 1 — Baseline

Audit date: 2026-08-14 (Asia/Bangkok)

## Repository

- Branch: `feature/kai-phase1e-knowledge-layer`
- HEAD: `d5e8c6a585eb71eec82fc422e2939d45f31ba2e6`
- Working tree: already contains unrelated user changes in 22 tracked files and two untracked artifact directories. Those changes are preserved.
- Local Operations D1: migrations `0000`–`0023` applied; no `agri_*` tables existed at audit time.
- Remote D1 / Production: not accessed and not changed.

## Architecture audit

- Runtime: Next/Vinext app router on Cloudflare Workers with D1 bindings.
- Company authorization: Firebase token verification, then `requireCompanyContext()` with company membership and role permission before company-scoped query access.
- Operations data: `OPERATIONS_DB`; company/membership authority: `COMPANY_DB`.
- GIS: MapLibre + shared Protomaps/PMTiles basemap and Myanmar township datasets.
- KAI: existing intent/runtime/query-plan system; no Agriculture intents or query service found.

## KMM_WEATHER_BACKEND_AUDIT

| Capability | Status | Evidence |
| --- | --- | --- |
| Open-Meteo | LIVE | `/api/weather` calls `fetchLiveWeather()` and Open-Meteo forecast API |
| ECMWF | UNKNOWN | no explicit model selection or model metadata in the current contract |
| GSMaP | ABSENT | no repository implementation found |
| GPM | ABSENT | no repository implementation found |
| Himawari | ABSENT | no repository implementation found |
| Soil moisture | ABSENT | not requested by the current Open-Meteo query and not stored in the weather payload |
| Forecast | LIVE | current + hourly + daily Open-Meteo; 7 forecast days and 1 past day |
| Historical rainfall | PARTIAL | only the one-day backfill used to calculate trailing 24-hour rainfall |
| Rainfall anomaly | ABSENT | no climatology/anomaly table or service |
| Flood risk | ABSENT | current UI has a deterministic rain/routing risk, not a flood model |
| Drought risk | ABSENT | no drought model or source |
| Source freshness | PARTIAL | `fetchedAt`, cache status, and cache age exist; source run/valid timestamps do not |
| Fallback | LIVE + STALE | in-memory last-known-good weather up to 30 minutes; otherwise request fails closed |
| Weather alerts | LIVE | deterministic alerts from live rainfall/rain probability |
| Agricultural impact | MOCK/RULE-BASED UI | existing Weather page copy is planning guidance derived from weather rules; no crop-specific facts or agronomic source |

## Agriculture readiness

`PARTIAL`.

The existing Weather service is suitable as the shared live weather input for a Phase 1 shell and safe read-only status display. It is not sufficient evidence for township crop presence, crop stage, exact calendar dates, soil moisture, climatology, or actionable sales opportunities. Phase 1 must therefore keep unsupported agriculture values as `N/A`, `No Data`, `Unknown`, or `Needs Verification` and must not seed mock operational opportunities.

## Safety boundary

The implementation may add local Operations D1 migrations, shared contracts, deterministic services, authorized local APIs, and UI. It must not deploy, run remote migrations, change Sales/Booking/Stock data or formulas, or use Mockup sample numbers as production data.
