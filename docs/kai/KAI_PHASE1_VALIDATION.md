# KAI Phase 1E — Knowledge Layer Validation

Date: 2026-08-12
Branch: `feature/kai-phase1e-knowledge-layer`
Scope: additive knowledge tables and seed only. No KAI route, UI, LLM, recommendation, or dashboard logic changes.

## Real database audit

The repository's current D1 split was inspected before writing the mapping:

| Business domain | Verified D1 binding | Verified table | Notes |
|---|---|---|---|
| Sales | `OPERATIONS_DB` | `sales_transactions` | Source of sale date, quantity, product type, value, GP1, branch, model, and salesperson fields. |
| Booking | `OPERATIONS_DB` | `booking_transactions` | Source of booking date, booking number, price, deposit, status, branch, model, and customer fields. |
| Stock | `OPERATIONS_DB` | `stock_transactions` | Source of snapshot date, stock age, current status, product, MSRP, physical identifiers, and ownership flag. |
| Branch master | `COMPANY_DB` | `branches` | Source of branch code/name, region, township, and company scope. |
| Product master | Not found | — | No `product` or `product_master` table exists in the inspected schema. Product classification is recorded as an application mapping, not as a fabricated table. |

Important confirmed implementation rules:

- Sales Unit uses `quantity` and the existing engine product mapping `TT`, `CH`, `EX`, `TP`.
- Sales Value uses the existing business-service source `final_received`; `sale_amount` is retained as a separate raw field.
- GP uses `gp1` only when the scoped rows have complete GP1 data.
- Booking Unit is a count of booking transaction rows. The source contract must confirm whether one row always represents one physical unit.
- Stock Unit follows the existing current Free Stock and physical-identifier de-duplication rules; it is not a blind `COUNT(*)` over all imported rows.
- Stock Aging uses the verified `stock_age_days` field. The Phase 1E thresholds are `>90` days for Aging Stock and `>180` days for Slow Moving.

## Deliverables

- `drizzle/operations/0007_create_kai_knowledge_tables.sql` — six additive tables and indexes.
- `drizzle/operations/0008_seed_kai_knowledge.sql` — 14 metrics, 55 verified data dictionary mappings, 34 question examples, 31 query templates, and 22 response templates.
- `docs/kai/rollback_0007_0008_kai_knowledge_layer.sql` — manual rollback for only the six KAI tables.
- `tests/kai-phase1e-knowledge-layer.test.mjs` — migration, seed, real-schema mapping, coverage, and rollback checks.

The referenced workbook `KAI_Phase1E_Knowledge_Layer_v1.xlsx` was not present in the accessible workspace. Therefore the seed is reconstructed from the latest task specification and the verified repository schema; it is not claimed to be a byte-for-byte workbook import.

## Validation commands

Baseline before the KAI files were added:

```text
npm test
288 passed, 0 failed
```

Phase 1E focused checks:

```text
node --test tests/kai-phase1e-knowledge-layer.test.mjs
```

Full regression after the KAI files are added:

```text
npm test
```

Observed result after the KAI files were added: `288 passed, 0 failed`.

Local Wrangler D1 migration result: both migration files applied successfully and returned the expected row counts (`14 / 55 / 34 / 31 / 22`).

The remote D1 databases are not mutated by this validation. Apply the operations migrations only after review, using the appropriate staging or production migration configuration:

```text
npx wrangler d1 migrations apply kmm-operations-staging --remote --config wrangler.staging.jsonc
npx wrangler d1 migrations apply kmm-operations --remote --config wrangler.operations.jsonc
```

## Completion report

```text
KAI_PHASE1E_COMPLETE
Commit: recorded after validation
Migration: 0007_create_kai_knowledge_tables.sql + 0008_seed_kai_knowledge.sql
Validation: PASS
Ready for Phase 2: NO — remote D1 apply and runtime KAI query integration remain Phase 2 work
```
