# KAI Phase 2B-03 — Natural Language Coverage

KAI_PHASE2B_03_NATURAL_LANGUAGE_COVERAGE_COMPLETE

## Tests

- PASS: 151/151 expanded database-backed coverage cases (100%).
- PARTIAL: 0
- FAIL: 0
- NO_DATA: 2 verified unsupported baseline capabilities (Cash Payment Type, Outstanding Booking).
- AMBIGUOUS_SAFE: 3/3 (`ยอด KMM03 เท่าไร`, `M7040 เท่าไร`, `KMM03 เท่าไร`).
- HALLUCINATION: 0

Coverage Before: 96.15% (50/52)
Coverage After: 100% (151/151 executable variants)

## Coverage dimensions

- Thai Paraphrase: PASS
- English Paraphrase: PASS
- Mixed Language: PASS
- Temporal Parsing: PASS (today, yesterday, current week, last month, current/previous quarter, MTD, YTD, year and ISO date ranges)
- Multi-filter: PASS (company context, branch/branch alias, product group/code, model, salesperson, year/month/date range, metric, sort, limit)
- Ranking: PASS (verified units/value ordering and top-N limits)
- Ambiguity Handling: PASS

Executable Query Templates: 34/34 (all version 2 plans)

## Product code audit

Observed local Operations D1 values were audited without inventing mappings:

- Sales: `01-TT`, `02-CH`, `03-TP`, `04-EX`, `05-TX`, `06-IM`, `07-IMO`, `08-OT`, `MITSU`
- Booking: `01-TT`, `02-CH`, `04-EX`
- Stock: `01-TT`, `02-CH`, `03-EX`, `04-TP`, `06-IM`, `07-IMO`, `08-TX`
- Verified aliases: `TT`/Tractor, `CH`/Combine, `EX`/Excavator, `TP`/Transplanter, plus branch master aliases `KMM01`/`Hpa-an`, `KMM02`/`Mawlamyine`, `KMM03`/`Tharyarwaddy`.
- Codes with no verified group/model definition remain unclassified and are never guessed.

Cash Payment Type: UNSUPPORTED

Outstanding Booking: UNSUPPORTED

## COMPANY_DB architecture

No Branch Master duplication was added. The authenticated `/api/kai/query` path reads permission-checked branches from `COMPANY_DB` through `requireCompanyContext`, passes only read-only branch vocabulary to the runtime, and executes transactional queries against `OPERATIONS_DB`. Production bindings and remote D1 were not changed.

## Validation

- Existing Regression: 311/311 PASS
- TypeScript: PASS (`npx tsc --noEmit`)
- Build: PASS (`npm test`, which runs `npm run build`)
- Local D1: PASS (`34` templates, `34` executable version-2 plans; local `wrangler d1 execute --local`)
- Production: UNCHANGED
- Remote D1: UNCHANGED

## Remaining gaps

1. Customer purchase/sales questions remain unavailable because verified customer fields exist only on Booking; the runtime returns a safe NO_DATA response.
2. `05-TX` and `MITSU` Sales product mappings have no verified product-group definition and remain unclassified.
3. Insight, root-cause, forecast, recommendation, and management-advice behavior remains intentionally out of scope.

Ready for Phase 2B-04: YES

Report: this file plus the runtime and coverage test changes listed in the commit.
