# Commission Phase C1 — Local Schema and Data Hub Pipeline

Status: complete for Local development only. Applied Local Operations migration: `0021_add_sales_commission.sql`. No Production or Remote D1 command was run.

## Verified pipeline

`2608_KMM_CPI.xlsx` column 63, `Total` → Data Hub `commission` → `OPERATIONS_DB.sales_transactions.commission` → authenticated `/api/sales` → canonical/legacy Sales row.

- D1 storage: nullable `TEXT`, matching existing monetary source-value storage (`final_received`, `gp1`, `expense`).
- Numeric behavior: blank stays `null`; explicit zero stays `"0"` in D1 and `0` in API; formatted integer/decimal text is normalized without rounding; non-numeric Commission is rejected.
- Controlled aliases: `Total`, `Commission`, `Commission Total`. `Expense` and `Total Expense` map only to `expense`.
- The new field is additive. No KPI, Sales/GP formula, KAI query, UI layout, or static fallback was changed.

## Local sample verification

The referenced source workbook is not present in this workspace, so no user dataset was imported or modified. `tests/commission-phase-c1.test.mjs` uses controlled Local CPI-shaped records and checks the same mapping, nullable persistence convention, and API adapter path.

| Source salesperson | Sales Value | GP | Source Total | Imported/D1/API Commission |
| --- | ---: | ---: | ---: | ---: |
| SP-001 | 95,000 | 10,000 | 1,250.50 | 1,250.50 |
| SP-002 | 200,000 | 30,000 | 0 | 0 |
| SP-003 | 50,000 | 5,000 | blank | null |

## Identity recommendation for C2

Commission aggregation must not use display-name normalization. Current Local rows have incomplete identifiers: `salesperson_code` is missing on 1,455 of 3,417 rows and `employee_code` on 316 rows. C2 should resolve each transaction in this order: active canonical `salesperson_code`, then `employee_code`, then a unique Company Master relation. Any unresolved identity must remain unavailable/excluded with an explicit data-quality state rather than falling back to a display name.

## Validation

- Focused C1 test: schema, mapping, numeric/null validation, zero/decimal preservation, local D1-compatible round trip, API adapter, and no static API fallback.
- Existing CPI, Sales integration, and D1 batching tests remain green.
- Full regression, TypeScript, lint, build, and diff validation are recorded in the delivery report.
