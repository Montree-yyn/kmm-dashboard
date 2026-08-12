# KAI Phase 1E Runtime Test Fix

Baseline: `d7d0766`
Environment: local `kmm-operations` D1 only
Scope: Knowledge Layer, aliases, and Query Mapping

No Runtime Query Engine, Chat UI, LLM, or remote D1 was used.

## KAI_PHASE1E_RUNTIME_TEST_PASS

### Result

Strict Test Cases: **5/5 PASS**
Focused Phase 1E tests: **11/11 PASS**
Full regression suite: **288/288 PASS**
Phase 2 Ready: **YES**

## Changes Applied

- `0012_standardize_kai_runtime_intents.sql` standardizes the requested canonical intents across `kai_question_library`, `kai_query_templates`, and `kai_response_templates`:
  - `SALES_CURRENT_MONTH`
  - `SALES_YOY_COMPARE`
  - `BOOKING_CURRENT_MONTH`
  - `BOOKING_YOY_COMPARE`
  - `BOOKING_AGING`
  - `STOCK_CURRENT`
  - `STOCK_AGING_MODEL`
- `0013_seed_kai_runtime_paraphrases.sql` adds the exact test questions and business-language aliases for Sales, Booking, and Stock aging.
- `0014_fix_kai_stock_age_mapping.sql` changes Stock aging knowledge to verified `stock_age_days` and records the fallback application mapping.

## Strict Runtime Test Results

| Test | Intent | Domain | Primary Metric | Query Template | Response Template | Result |
|---|---|---|---|---|---|---|
| 01 Sales Current | `SALES_CURRENT_MONTH` | Sales | `SALES001` — Sales Unit | PASS | PASS | **PASS** |
| 02 Sales Year Comparison | `SALES_YOY_COMPARE` | Sales | `SALES001` — Sales Unit | PASS | PASS | **PASS** |
| 03 Booking Current | `BOOKING_CURRENT_MONTH` | Booking | `BOOK001` — Booking Unit | PASS | PASS | **PASS** |
| 04 Booking Aging | `BOOKING_AGING` | Booking | `BOOK003` — Booking Aging | PASS | PASS | **PASS** |
| 05 Stock Aging by Model | `STOCK_AGING_MODEL` | Stock | `STOCK003` — Stock Aging | PASS | PASS | **PASS** |

## Stock Age Field Audit

The real `stock_transactions` schema contains:

- `stock_age_days` — persisted source/application value used by Query Mapping.
- `stock_date` — age start date.
- `as_of_date` — required Stock snapshot date and fallback reference.
- `snapshot_date` — optional calculation reference.

The verified import mapping is:

1. Use source `stock_age_days` when present.
2. Otherwise calculate `max(0, floor((snapshot_date - stock_date) / 86400000))`.
3. During import, `stock_date` falls back to `as_of_date`.
4. No `receive_date` field exists in the real schema; it is not used or invented.

The mapping is recorded in `kai_data_dictionary` as `APPLICATION_MAPPING` at `app/api/data-hub/import/route.ts::calculateAgeDays`. Stock business-rule conditions now reference `stock_age_days` explicitly.

## Validation Evidence

| Check | Result |
|---|---:|
| Question → Intent coverage | PASS; exact five test questions resolve to the canonical intents |
| Intent → Query coverage | PASS; all five canonical intents have Query Templates |
| Intent → Response coverage | PASS; all five canonical intents have Response Templates |
| Question → Metric coverage | PASS; all five resolve to existing metrics |
| Question/Query orphan rows | 0 |
| Query/Response orphan rows | 0 |
| Duplicate alias mappings | 0 |
| Local SQLite integrity | `ok` |
| Knowledge counts | Metrics 14, Data Dictionary 56, Questions 44, Queries 31, Responses 31, Rules 10, Aliases 18, History 0 |

## Recommendation

The Phase 1E Knowledge Layer passes the requested strict runtime mapping test and is ready for Phase 2A. Phase 2 must continue to use `stock_age_days` and the documented application mapping; it must not introduce `receive_date` as a physical source field.

`KAI_PHASE1E_RUNTIME_TEST_PASS`

Commit: reported in the final handoff
Phase 2 Ready: `YES`
