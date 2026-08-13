# Commission Phase C2 — Local Backfill and Safe Ranking

Status: complete for Local development only. No Production deployment, Production D1, or Remote D1 command was run.

## Source audit

- Workbook: `/Users/CAKE/Documents/KMM_Sales_2026/01_Data/Sales/2608_KMM_CPI.xlsx`
- Worksheet: `2026_KMM_DATA`; 3,417 data rows.
- Commission header: `BL` / `Total` (the workbook's logical field 63; zero-based cell index 63).
- Numeric Total: 3,417; zero: 3,043; blank: 0; invalid: 0.
- Source Commission total: `341,705,800` MMK.
- Salesperson codes: 30 distinct; 798 source rows have no usable code.

## Matching and reconciliation gate

The deterministic transaction key is `Sale Memo No.2 + Delivery Date + Dealer + MODEL + Sales Code + Final Received + GP1`. Model punctuation is normalized only for the key (`DC-70G PRO` equals `DC70G PRO`); no financial value is normalized or inferred.

| Preview status | Rows | Commission (MMK) |
| --- | ---: | ---: |
| VALUE_CHANGED (before Local apply) | 3,167 | 341,705,800 |
| ALREADY_MATCHING (after re-run) | 3,167 | 341,705,800 |
| UNMATCHED | 0 | 0 |
| AMBIGUOUS | 250 | 0 |
| INVALID_COMMISSION | 0 | 0 |

All 250 ambiguous rows have a zero source Total. They were deliberately not updated; their Local D1 Commission remains `NULL`. Source total, uniquely matched total, Local D1 stored total, and the authenticated API adapter total reconcile to `341,705,800` MMK with zero unexplained variance.

## Local backfill

`scripts/backfill-local-sales-commission.mjs` has a preview default and applies only with `--apply`. It writes only `sales_transactions.commission` in the Local Operations D1 database and uses a single transaction. The initial run updated 3,167 rows. A second preview showed zero changed rows and 3,167 already matching rows.

After the run: 3,417 Sales rows; 2,793 explicit zero values; 250 `NULL` values; stored Commission sum `341,705,800` MMK.

## Safe ranking aggregation

Salespeople Ranking now receives Commission from the authenticated Sales API data path. Commission grouping resolves financial identity in this order: `salesperson_code`, `employee_code`, then exactly one Salesperson Master name relation. Unresolved identity has no person-level Commission aggregation. Display-name-only grouping is not used for Commission.

API Commission total is `341,705,800` MMK. Safe person aggregation is `341,305,800` MMK: 1,962 Commission rows resolve by salesperson code, 657 by employee code, and 593 non-null Commission rows remain unresolved. The `400,000` MMK difference is therefore explicitly excluded rather than allocated by a display name.

The table continues to use its existing Sales/GP rows and filter context; Commission Value, % of Sales and % of GP are derived from those same filtered rows. A zero Sales or GP denominator displays `N/A`.

## Manual Local checks

| Salesperson | Code | Rows | Sales Value | GP | Commission | % Sales | % GP |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| U Aung Bo Bo | MM170313 | 459 | 34,519,150,153 | 3,446,275,703 | 72,485,750 | 0.2100% | 2.1033% |
| U HLA MYO OO | MM171002 | 458 | 27,416,486,948 | 2,461,140,104 | 62,998,550 | 0.2298% | 2.5597% |
| Daw Nandar Hlaing Win | MM230301 | 272 | 20,246,442,110 | 1,904,126,685 | 35,900,000 | 0.1773% | 1.8854% |
| Than Htun Aung | MM240201 | 253 | 20,051,554,125 | 2,020,333,684 | 31,950,000 | 0.1593% | 1.5814% |
| 02-ZMK (Out) | MM190905 | 236 | 13,540,491,560 | 1,566,850,360 | 28,350,000 | 0.2094% | 1.8094% |

Formula: `Commission / Sales Value × 100` and `Commission / GP × 100`; displayed UI values round to one decimal place.
