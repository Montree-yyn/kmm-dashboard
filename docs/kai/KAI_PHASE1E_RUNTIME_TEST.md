# KAI Phase 1E Runtime Query Test

Baseline commit: `e6c09a8`
Scope: Knowledge Layer and Query Mapping only
Environment: local `kmm-operations` D1 after migrations `0009`–`0011`

No Runtime Query Engine, Chat UI, LLM, or remote D1 was used.

## KAI_PHASE1E_RUNTIME_TEST_COMPLETE

### Result

Strict contract result: **0/5 PASS**
Canonical knowledge-chain coverage: **5/5 has a Metric → Query → Response path**
Phase 2 Recommendation: **NEED FIX**

The strict result is not a data failure. Four expected Intent identifiers in this test do not exist in the Phase 1E knowledge tables, and one requested Stock aging formula cannot be verified from the real source schema.

## Test Results

| Test | Expected Intent | Actual canonical Intent | Metric | Query Template | Response Template | Result |
|---|---|---|---|---|---|---|
| 01 Sales Current | `SALES_CURRENT_MONTH` | `SALES_CURRENT` | `SALES001` — Sales Unit | PASS via `SALES_CURRENT` | PASS via `SALES_CURRENT` | **FAIL: Intent contract mismatch** |
| 02 Sales Year Comparison | `SALES_YOY_COMPARE` | `SALES_YOY_COMPARE` | `SALES001` — Sales Unit, plus comparison metrics | PASS | PASS | **PASS with question-phrase caveat** |
| 03 Booking Current | `BOOKING_CURRENT_MONTH` | `BOOKING_CURRENT` | `BOOK001` — Booking Unit | PASS via `BOOKING_CURRENT` | PASS via `BOOKING_CURRENT` | **FAIL: Intent contract mismatch** |
| 04 Booking Aging | `BOOKING_AGING` | `BOOKING_AGING_QUERY` | `BOOK003` — Booking Aging | PASS | PASS | **FAIL: Intent contract mismatch** |
| 05 Stock Aging by Model | `STOCK_AGING_MODEL` | `STOCK_AGING_MODEL_RANKING` | `STOCK003` — Stock Aging | PASS | PASS | **FAIL: Intent and rule contract mismatch** |

## Validation Summary

| Validation | Result | Evidence |
|---|---:|---|
| Intent Mapping | **FAIL** | `SALES_CURRENT_MONTH`, `BOOKING_CURRENT_MONTH`, `BOOKING_AGING`, and `STOCK_AGING_MODEL` are absent from the Intent tables. |
| Metric Mapping | **PASS** | All five cases resolve to an existing metric; Sales Unit, Booking Unit, and Stock Aging are defined. |
| Query Template Mapping | **PASS canonical / FAIL strict** | Every actual canonical Intent has a Query Template; the four expected alias names do not. |
| Response Template Mapping | **PASS canonical / FAIL strict** | Every actual canonical Intent has a Response Template; the four expected alias names do not. |
| Booking Aging Rule | **PASS** | `age_days > 90` is seeded as `Critical` in `BOOKING_AGING_GT_90`. |
| Stock Aging Rule | **NEED FIX** | Knowledge uses `stock_age_days > 90`; the exact `Today - Receive Date > 90` formula is not verified because no raw `receive_date` field exists. |

## Issues Found

1. **Intent naming drift:** the test contract and stored canonical names differ. One naming convention must be selected, or an explicit intent-alias/canonicalization layer must be added before Phase 2.
2. **Paraphrase coverage is not proven:** the library contains the equivalent wording `ยอดขายเดือน 5 ปี 2023 เทียบปีนี้เป็นอย่างไร`, but not the exact Test 02 wording with `กับ`; the Booking aging wording also differs. Without a Runtime Query Engine, these are coverage observations, not proof of natural-language resolution.
3. **Stock aging source boundary:** the verified source fields are `stock_age_days`, `stock_date`, and `as_of_date`. The system must not invent `receive_date` or claim the requested derivation until the application mapping is explicitly approved.
4. **Generic Model alias:** `รุ่น` currently maps to `MODEL_FILTER`, which is a token-level intent without a Query Template. Runtime must resolve it using domain context, or the alias design must be made context-specific.

## Recommendation

Phase 2 should **not** start under the strict test contract. First reconcile the four Intent names, add or approve paraphrase coverage, and decide the verified Stock aging derivation; then rerun this test expecting 5/5 strict PASS.

`KAI_PHASE1E_RUNTIME_TEST_COMPLETE`

Test Cases: `0/5` strict PASS
Issues Found: 4 contract/mapping issues listed above
Phase 2 Recommendation: `NEED FIX`
Commit: reported in the final handoff
