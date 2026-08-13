# Commission C3.2C reconciliation

Status: `C3_2C_BUSINESS_CONFIRMATION_REQUIRED`

This is a read-only diagnosis of CPI v3 against the Production Sales snapshot taken before Commission backfill. It does not authorize a Sales import, identity merge, Commission write or Worker deployment.

## Result

The 54 rows that failed the original strict key are not 54 positive Commission transactions missing from Production.

| Category | Rows | Commission | Evidence |
| --- | ---: | ---: | --- |
| `SALESPERSON_CODE_CHANGED` | 38 | 5,732,800 MMK | One Production row matches exactly on invoice, date, branch, normalized model, Sales Value and GP; only identity differs. |
| `TRANSACTION_KEY_CHANGED` | 5 | 0 MMK | One invoice/model/value candidate exists; date differs. |
| `PRODUCTION_DATA_OLDER_THAN_CPI` | 11 | 0 MMK | CPI rows are dated 2026-08-05 through 2026-08-10; Production's latest Sales date is 2026-07-31. |

All seven positive rows are in `SALESPERSON_CODE_CHANGED`; therefore no positive Commission is supported as a missing Sales transaction. The original `5,732,800 MMK` gap is entirely an identity-key reconciliation issue.

## Known people

| CPI identity | Production transaction identity | Rows | Commission | Safe conclusion |
| --- | --- | ---: | ---: | --- |
| `MM220407` Kaung Si Thu `(Out)` | `MM230407` (11 rows) and `MM171002` (1 zero row) | 12 | 2,132,800 MMK | Transactions match, but no approved canonical-code evidence permits assigning the 11 positive rows to a different Production code. |
| `MM220406` Htet Lin Aung | `MM230406` / `03-Lin Aung` | 21 | 3,600,000 MMK | Transactions match, but the source and Production codes and names conflict. Do not merge or alias without business confirmation. |

The other five zero-Commission identity changes also require no Commission write, but prove the strict original key was too rigid for transaction matching.

## Source versus Production mathematics

- CPI rows: 3,417; Production rows: 3,376; delta: 41.
- Primary-key groups: CPI 3,220; Production 3,207; delta: 13.
- Duplicate rows beyond unique primary keys: CPI 197; Production 169; delta: 28.
- `13 + 28 = 41`; the row-count difference is fully explained.
- Strict one-to-one matches: 3,113. Duplicate/composite rows: 250, all zero Commission. Unmatched strict-key rows: 54.
- Primary key groups unique to CPI: 56; unique to Production: 43. The net group delta is 13. No count is unexplained.

## Sales data gap and impact

The 11 CPI-only rows are later August Sales, not positive Commission rows. If approved as corrected Production Sales, they would change Production from 3,376 to 3,387 rows and add:

- 9 engine units
- 1,490,266,100 MMK Sales Value
- 115,837,850 MMK GP

All impact is August 2026: KMM01 2 rows / 280,165,500 MMK; KMM02 3 / 445,466,500 MMK; KMM03 6 / 764,634,100 MMK. July remains unchanged.

The Data Hub's Sales endpoint deliberately replaces the complete company Sales dataset on an approved import. Production history records only `production-operations-bootstrap` (3,376 rows), not an approved CPI v3 Sales import. CPI v3 therefore proves that Production is older than the workbook, but it does not by itself authorize a full Sales replacement.

## Required business decision

`PATH D — BUSINESS CONFIRMATION REQUIRED`

1. Confirm the canonical ownership for each positive exact-transaction mismatch, especially `MM220406` CPI versus `MM230406` Production and `MM220407` CPI versus `MM230407` Production.
2. Decide whether CPI v3 is the approved full Sales source for Production, including the 11 August rows. If yes, approve a governed full Sales import and its stated KPI impact; if no, formally exclude them.
3. After those decisions, change the local backfill matcher to use the verified identity-independent transaction key only for the explicitly approved code mappings, then rerun the preview. Do not use fuzzy names.

Production Commission remains 0 MMK. No Sales, Commission or Worker write was performed during C3.2C.
