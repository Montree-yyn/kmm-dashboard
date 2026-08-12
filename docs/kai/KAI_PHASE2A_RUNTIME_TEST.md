# KAI Phase 2A Runtime Query Test

Status: `KAI_PHASE2A_RUNTIME_QUERY_COMPLETE`

Test date: 2026-08-12

Environment: Local Operations D1 (`kmm-operations`), company `kmm-company`, timezone `Asia/Yangon`, reference date `2026-08-12`

## Scope

Phase 2A only:

`Question → Intent → Knowledge Layer → Parameterized read-only query → Local D1 → Response`

The endpoint is `POST /api/kai/query`. It is authenticated and company-scoped through the existing server access layer. No Chat UI, LLM integration, recommendation engine, or remote deployment was added.

## Knowledge and database validation

| Check | Result | Evidence |
| --- | --- | --- |
| Knowledge tables available in Local D1 | PASS | `kai_metrics`, `kai_data_dictionary`, `kai_question_library`, `kai_query_templates`, `kai_response_templates`, `kai_history`, plus Phase 1E `kai_alias_mapping` and `kai_business_rules` |
| Executable query plans | PASS | 5 Phase 2A plans with JSON plan version 1 |
| Source and field mapping | PASS | Runtime validates each plan against `kai_data_dictionary` before execution |
| User text to SQL safety | PASS | User text resolves an intent; SQL is generated only from the validated knowledge plan and bound parameters |
| Query mutability | PASS | Runtime executes `SELECT` statements only |
| Stock age field | PASS | Uses verified `stock_transactions.stock_age_days` |

## Runtime cases

All five cases were executed against Local Operations D1. The values below are the actual result for the fixed test date, not fixtures.

### 1. Sales Current

- Question: `เดือนนี้ขายได้กี่คัน`
- Intent: `SALES_CURRENT_MONTH`
- Metric: `SALES001` — Sales Unit
- Query Template: `SALES_CURRENT_MONTH` → `sales_transactions`, current month by `sale_date`, company-scoped
- Database result: Period `2026-08`; Sales Unit `0`; Sales Value `NULL`
- Response: `Period: 2026-08; Sales Unit: 0; Sales Value: N/A`
- Result: PASS

`NULL` Sales Value is preserved as `N/A` because no valid current-month value was present in the Local D1 result.

### 2. Sales Year Comparison

- Question: `ยอดขายเดือน 5 ปี 2023 เทียบกับปีนี้เป็นอย่างไร`
- Intent: `SALES_YOY_COMPARE`
- Metric: `SALES001` — Sales Unit
- Query Template: `SALES_YOY_COMPARE` → two `sales_transactions` month windows, `2023-05` vs `2026-05`
- Database result: 2023 = `10` units / `809,015,900`; 2026 = `17` units / `2,311,582,645`; difference = `7` units / `1,502,566,745`; unit growth = `70%`
- Response: `Previous Year 2023: 10 units; Current Year 2026: 17 units; Difference: 7 units; Growth: 70%`
- Result: PASS

### 3. Booking Current

- Question: `เดือนนี้จองเท่าไหร่`
- Intent: `BOOKING_CURRENT_MONTH`
- Metric: `BOOK001` — Booking Unit
- Query Template: `BOOKING_CURRENT_MONTH` → `booking_transactions`, current month by `booking_date`, company-scoped
- Database result: Period `2026-08`; Booking Unit `16`; Booking Value `2,604,130,000`
- Response: `Period: 2026-08; Booking Unit: 16; Booking Value: 2,604,130,000`
- Result: PASS

### 4. Booking Aging

- Question: `Booking เกิน 90 วันมีกี่คัน`
- Intent: `BOOKING_AGING`
- Metric: `BOOK003` — Booking Aging
- Query Template: `BOOKING_AGING` → `booking_transactions`, `booking_date` age `> 90`, excludes closed lifecycle statuses
- Database result: Total `7`; model groups include `DC70G PRO: 3`, `M9540+FD: 2`, `L5228+FD: 1`, `M6040HI+FD: 1`; branch groups include `KMM03: 4`, `KMM01: 2`, `KMM02: 1`
- Response: `Booking Aging > 90 days; Total: 7;` followed by model and branch breakdowns
- Result: PASS

### 5. Stock Aging by Model

- Question: `Stock เกิน 90 วันมีรุ่นอะไรบ้าง`
- Intent: `STOCK_AGING_MODEL`
- Metric: `STOCK003` — Stock Aging
- Query Template: `STOCK_AGING_MODEL` → `stock_transactions`, `stock_age_days > 90`, Free Stock/KMM scope, physical-identifier deduplication
- Database result: Total `220`; top model groups include `CONCAVE For BK70: 36`, `DC70G PRO: 22`, `DH246F: 21`, `Sub Soiler SS3 3 Legs - M8540/M9540: 11`, `CS22S-OS16D24: 10`
- Response: `Stock Aging > 90 days; Total: 220;` followed by all model groups and maximum age days
- Result: PASS

## Validation summary

| Validation | Result |
| --- | --- |
| Intent mapping | 5/5 PASS |
| Metric mapping | 5/5 PASS |
| Query template mapping | 5/5 PASS |
| Response template mapping | 5/5 PASS |
| Phase 2A focused runtime cases | 5/5 PASS |
| Phase 1E focused tests | 11/11 PASS |
| Build / TypeScript validation | PASS |
| Existing regression suite | 288/288 PASS |
| Local D1 | PASS |
| Production | UNCHANGED — no deploy performed |
| Remote D1 | UNCHANGED — only `--local` was used |

## Implementation files

- `lib/kai/runtime-query.ts` — knowledge-driven plan resolver, read-only SQL builder, D1 executor, and response formatter
- `app/api/kai/query/route.ts` — authenticated `POST /api/kai/query` endpoint
- `drizzle/operations/0015_seed_kai_phase2a_query_plans.sql` — executable plans for the five supported intents
- `tests/kai-phase2a-runtime.test.mjs` — local D1 runtime and safety tests

## Recommendation

Phase 2A is ready for handoff to Phase 2B. The next phase may build on this contract, but must retain company authorization, dictionary validation, parameterized SQL, and read-only execution boundaries.

Commit: final Git commit for this implementation (reported in the handoff)

Ready for Phase 2B: `YES`
