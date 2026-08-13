# KAI Phase 2B-01 — Database Coverage Audit

Audit date: 2026-08-13 (Asia/Bangkok). Scope was read-only and local only.
No production endpoint, remote D1 database, migration, deployment, or application
source file was changed.

## 1. Architecture audit

| Concern | Verified implementation |
| --- | --- |
| Runtime endpoint | app/api/kai/query/route.ts. POST parses a bounded question, calls requireCompanyContext with permission view, obtains OPERATIONS_DB, and calls executeKaiRuntimeQuery. |
| Runtime routing and query builder | lib/kai/runtime-query.ts. Exact question first, then alias substring matching; executable JSON plans only; allow-listed identifiers and parameter binding; only SELECT is generated. |
| Metrics, vocabulary, plans, templates | Local Operations D1 tables kai_metrics, kai_alias_mapping, kai_question_library, kai_query_templates, kai_response_templates, kai_data_dictionary, kai_business_rules. |
| Response formatting | lib/kai/runtime-query.ts functions formatSalesSummary, formatYearComparison, formatBookingSummary, formatBookingAging, formatStockAging, and formatResponse. |
| Client fallback | lib/kai/client.ts calls /api/kai/query first. Only HTTP 422 unsupported_question falls back to /api/kai/chat. |
| Legacy deterministic business path | app/api/kai/chat/route.ts; lib/kai/tools/registry.ts; lib/kai/tools/kmm-business.ts; lib/kai/tools/response-composer.ts. This is distinct from the Phase 2A D1 runtime. |
| D1 access | db/index.ts exposes getOperationsDb and getCompanyDb. The query route directly binds only OPERATIONS_DB. |
| Authentication and authorization | lib/server/firebase-auth.ts; lib/server/company-context.ts; lib/kai/business/access-context.ts. The query route uses server-side company context and view permission; the client companyId is not authority. |
| Existing tests | tests/kai-phase2a-runtime.test.mjs, tests/kai-phase1e-knowledge-layer.test.mjs, tests/kai-phase1e-fix.test.mjs, tests/kai-stock-parity.test.mjs, tests/kai-sales-area.test.mjs, tests/kai-header-regression.test.mjs. |
| Migrations | drizzle/operations/0000_operations_import_metadata.sql through 0017_reconcile_kai_stock_unit_mapping.sql. Local Operations D1 shows all 18 applied. |

Result: **PASS**. The runtime is authenticated, company-scoped, parameterized and
read-only. Its actual database coverage is limited to five executable plans:
SALES_CURRENT_MONTH, SALES_YOY_COMPARE, BOOKING_CURRENT_MONTH, BOOKING_AGING,
and STOCK_AGING_MODEL. The other 26 query-template rows are non-executable
plain-text logic.

Scope boundary: this audit’s 50-question classification is for the exact
Phase 2A endpoint /api/kai/query and its Operations D1 executor. The UI client
does fall back to /api/kai/chat after runtime HTTP 422; that legacy path uses
lib/kai/tools/kmm-business.ts and its own repository/selectors. It is not an
executable-plan implementation and was not counted as Phase 2A database
coverage, so this report does not overstate endpoint capability as end-to-end
chat capability.

## 2. Local D1 schema audit

Two separate local Miniflare D1 files were found:

| Binding | Local file | Physical tables | KAI query route use |
| --- | --- | ---: | --- |
| OPERATIONS_DB | .wrangler/state/v3/d1/miniflare-D1DatabaseObject/9557d2211f1f75216a89f62aa8bc9fdc812aad5d673bb77601b0e6e2fedb8009.sqlite | 16 | Yes |
| COMPANY_DB | .wrangler/state/v3/d1/miniflare-D1DatabaseObject/25b8c09731e6730e7346a57bf0354f6ad5ba2f35e7efd12ab95fbb1bbe08d08a.sqlite | 21 | Indirectly, for authorization only |

No physical foreign keys exist in any Operations table (verified with
pragma_foreign_key_list). Relationships below are logical, normally by company_id;
the Company D1 supplies companies and branches.

### Operations D1 inventory

All columns below were read from local sqlite_master. PK means primary key; all
relationships are logical unless stated otherwise.

| Table (rows) | Columns: type | PK / relationship | Real sample | KAI use |
| --- | --- | --- | --- | --- |
| sales_transactions (3,376) | id:text; tenant_id:text; company_id:text; import_id:text; import_year:integer; import_month:integer; sale_date:text; invoice_no:text; branch:text; model_code:text; employee_code:text; quantity:integer; sale_amount:text; product_type:text; model:text; final_received:text; net_received:text; gp1:text; expense:text; salesperson_code:text; salesperson_name:text; created_at:text; created_by:text | PK id; company_id -> Company; employee/salesperson identifiers -> salesperson_master logically | 2023-01-02, KMM02, M6040+FD, 01-TT, quantity 1, final_received 55058300, gp1 -1141550 | Yes: current-month units/value and YoY only |
| booking_transactions (398) | id:text; tenant_id:text; company_id:text; import_id:text; import_year:integer; import_month:integer; business_week:integer; booking_date:text; booking_no:text; booking_number:text; branch:text; customer:text; product:text; status:text; booking_year:integer; booking_month:integer; branch_code:text; branch_name:text; salesperson_code:text; salesperson_name:text; product_type:text; product_model:text; customer_name:text; booking_price:text; deposit_amount:text; booking_status:text; purchase_status:text; created_at:text; created_by:text | PK id; company_id -> Company; branch/salesperson logical | Open KMM01 booking 2504-0003 for SAW PAN HLAING, model L5228+FD, price 112900000 | Yes: current-month total and >90-day aging |
| stock_transactions (748) | id:text; tenant_id:text; company_id:text; import_id:text; import_year:integer; import_month:integer; business_week:integer; as_of_date:text; branch:text; product:text; quantity:integer; stock_date:text; branch_code:text; branch_name:text; product_type:text; product_group:text; product_model:text; kmm_flag:integer; msrp:text; stock_status:text; stock_number:text; serial_number:text; engine_number:text; chassis_number:text; stock_age_days:integer; snapshot_date:text; created_at:text; created_by:text | PK id; company_id -> Company; physical identifiers support de-duplication | 2026-08-08, KMM01, DP224F-HP(Demo), 06-IM, Free Stock, age 4239, stock KMMS14085 | Yes: latest snapshot, KMM free-stock unit types, age >90 only |
| business_targets (72) | id:text; tenant_id:text; company_id:text; target_year:integer; target_month:integer; metric:text; target_value:text; product_group:text; branch_id:text; salesperson_id:text; source:text; source_version:text; approval_status:text; effective_from:text; created_at:text; created_by:text; updated_at:text; updated_by:text | PK id; company_id -> Company; branch_id/salesperson_id logical | 2026-01 SALES_REVENUE target 8085000000, approved | No |
| salesperson_master (18) | id:text; tenant_id:text; company_id:text; employee_code:text; salesperson_code:text; salesperson_name:text; status:text; created_at:text; created_by:text; updated_at:text; updated_by:text | PK id; company_id -> Company | MM160101 / U MYO LWIN OO / active | No |
| daily_management_inputs (0) | id:text; tenant_id:text; company_id:text; report_date:text; branch:text; draft_payload:text; published_payload:text; revision:integer; saved_at:text; published_at:text; created_at:text; created_by:text; updated_at:text; updated_by:text | PK id; company_id -> Company | No rows | No |
| data_column_mappings (0) | id:text; tenant_id:text; company_id:text; module:text; mapping:text; updated_at:text; updated_by:text | PK id; company_id -> Company | No rows | No |
| data_import_history (3) | id:text; tenant_id:text; company_id:text; module:text; import_year:integer; import_month:integer; filename:text; status:text; total_rows:integer; valid_rows:integer; warning_rows:integer; error_rows:integer; duration_ms:integer; error_report:text; imported_by:text; imported_at:text | PK id; company_id -> Company | local imports recorded for Sales, Booking, Stock | No |
| kai_metrics (14) | id:integer; metric_code:text; metric_name:text; description:text; formula:text; data_source:text; unit_type:text; business_rule:text; ai_usage:text; created_at:text | PK id; metric_code unique | SALES003 GP Value maps sales_transactions.gp1 | Yes: metadata only |
| kai_data_dictionary (57) | id:integer; business_name:text; table_name:text; field_name:text; data_type:text; description:text; domain:text; created_at:text | PK id | source mapping for sales, booking, stock, branches and application rules | Yes: plan validation |
| kai_question_library (44) | id:integer; question:text; intent:text; domain:text; required_metric:text; response_type:text; created_at:text | PK id | exact question “ยอดขายเดือนนี้” -> SALES_CURRENT_MONTH | Yes: exact routing |
| kai_query_templates (31) | id:integer; intent:text; purpose:text; required_data:text; query_logic:text; created_at:text | PK id; intent unique | five rows contain JSON plan version 1; 26 do not | Yes: query execution |
| kai_response_templates (31) | id:integer; intent:text; response_structure:text; created_at:text | PK id; intent unique | SALES_CURRENT_MONTH response template | Yes: metadata; runtime text is coded |
| kai_business_rules (10) | id:integer; rule_code:text; rule_name:text; condition:text; severity:text; action:text; domain:text | PK id; rule_code unique | STOCK_AGING_GT_365 / Critical | Not read by runtime query |
| kai_alias_mapping (18) | id:integer; alias_word:text; canonical_term:text; intent:text; domain:text | PK id; alias_word unique index | “ขาย” -> SALES_CURRENT_MONTH; “รถค้าง” -> STOCK_AGING_MODEL | Yes: alias routing |
| kai_history (0) | id:integer; user_question:text; intent:text; answer:text; feedback:text; created_at:text | PK id | No rows | No |
| d1_migrations | id:integer; name:text; applied_at:timestamp | PK id; name unique | 0017 applied 2026-08-12 03:33:47 | Migration state only |
| _cf_METADATA | key:integer; value:blob | PK key | Worker metadata | No |

### Company D1 inventory relevant to business vocabulary and permission

The Company D1 contains companies, company_users, branches, departments,
fiscal_years, holidays, working_calendars, company_currencies,
company_localizations, company_setting_drafts, audit_logs, plus duplicate
operational tables used by Company-management flows. Its physical table list is:
_cf_METADATA, audit_logs, booking_transactions, branches, business_targets,
companies, company_currencies, company_localizations, company_setting_drafts,
company_users, d1_migrations, daily_management_inputs, data_column_mappings,
data_import_history, departments, fiscal_years, holidays, sales_transactions,
salesperson_master, stock_transactions, working_calendars.

| Table | Columns: type | PK / relationship | Real sample | KAI use |
| --- | --- | --- | --- | --- |
| companies | id:text; tenant_id:text; company_id:text; company_name:text; company_code:text; legal_name:text; logo_url:text; tax_id:text; registration_number:text; business_type:text; industry:text; established_year:integer; website:text; email:text; phone:text; address:text; description:text; status:text; published_at:text; created_at:text; created_by:text; updated_at:text; updated_by:text | PK id; company_id and company_code unique | kmm-company / KMM Company / KMM / active | Indirect: authorization |
| company_users | id:text; tenant_id:text; company_id:text; user_id:text; email:text; role:text; status:text; created_at:text; created_by:text; updated_at:text; updated_by:text | PK id; company_id -> companies logically | Membership and role data | Indirect: permission |
| branches | id:text; tenant_id:text; company_id:text; branch_name:text; branch_code:text; region:text; township:text; address:text; manager:text; phone:text; email:text; latitude:text; longitude:text; time_zone:text; users:integer; has_transactions:integer; status:text; created_at:text; created_by:text; updated_at:text; updated_by:text | PK id; company_id -> companies logically; company_id + branch_code unique | KMM01 Hpa-an; KMM02 Mawlamyine; KMM03 Tharyarwaddy | Not queryable by /api/kai/query because it binds OPERATIONS_DB only |

Important schema fact: kai_data_dictionary has branch mappings, but the actual
branches table is in COMPANY_DB while the Phase 2A route passes only
OPERATIONS_DB. Therefore a future Branch plan cannot execute from that table
without an approved, explicit multi-binding design or a verified operational
branch source.

### Verified business vocabulary and data availability

Sales spans 2021-10-13 to 2026-07-31; Booking spans 2025-04-26 to 2026-08-07;
Stock is one 2026-08-08 snapshot. Branch values in all three operational tables
are KMM01, KMM02, KMM03. Salespeople include 01-Kay Khine Linn, 01-Nay Myo
(Out), 01-Ye Htet, 02-Aung Bo Bo, 02-Chan (Out), 02-Htet Wai Yan (Out),
02-Lin Tun, and 02-Nay Blute (Out). Booking has purchase_status values A HOT,
B HOT, Fail, S; it has no verified Cash payment type.

| Business term | Source codes/values actually found | Current alias / plan coverage |
| --- | --- | --- |
| TT / Tractor | Sales, Booking, Stock: 01-TT; runtime sales plan accepts 01-TT and TT | No TT/Tractor alias or product filter |
| CH / Combine | Sales, Booking, Stock: 02-CH; models include DC70G PRO | No CH/Combine alias or product filter |
| EX / Excavator | Sales: 04-EX; Booking: 04-EX; Stock: 03-EX | No EX alias; source coding is inconsistent |
| TP / Transplanter | Sales: 03-TP; Stock: 04-TP | No TP alias; source coding is inconsistent |
| IM | Sales/Stock: 06-IM | No alias or plan |
| IMO | Sales/Stock: 07-IMO | No alias or plan |
| OT | Sales: 08-OT; Stock uses 08-TX, not 08-OT | No alias or plan |
| Sales aliases | ขาย, ยอดขาย, Sales เดือนนี้, ยอดขายเดือนนี้, ยอดขายปัจจุบัน, เดือนนี้ขายได้กี่คัน | Current-month only; generic aliases over-match richer questions |
| Booking aliases | จอง, ใบจอง, เดือนนี้จองเท่าไหร่, ยอดจองเดือนนี้, Booking ปัจจุบัน, Booking เกิน 90 วันมีกี่คัน | Current-month or aging only |
| Stock aliases | รถค้าง, Stock เกิน 90 วัน, รถอายุเกิน 90 วัน, เกิน 90 วัน | Aging >90 only; no plain stock/สต็อก/คงเหลือ alias |
| Model alias | รุ่น -> MODEL_FILTER | Intent has no executable plan |

## 3. Coverage test (50 questions)

The runtime was executed directly against the local Operations D1 with companyId
kmm-company, timeZone Asia/Yangon, and fixed now 2026-08-12T12:00:00Z.
This is a read-only test of the exact Phase 2A executor, not a simulated result.

| # | Question | Classification | Observed outcome / root cause |
| ---: | --- | --- | --- |
| 1 | เดือนนี้ขายกี่คัน | NO_DATA | SALES_CURRENT_MONTH; Aug 2026 sales rows do not exist; 0 units / value N/A |
| 2 | ยอดขายเดือนนี้ | NO_DATA | Same current-month plan and no Aug Sales rows |
| 3 | Sales เดือนนี้ | NO_DATA | Same current-month plan and no Aug Sales rows |
| 4 | ขายเดือนนี้ | NO_DATA | Alias matched current-month plan; no Aug Sales rows |
| 5 | ยอดขายปัจจุบัน | NO_DATA | Same current-month plan and no Aug Sales rows |
| 6 | ปีนี้ขายกี่คัน | FAIL_MAPPING | “ขาย” alias runs current month, not year-to-date |
| 7 | เดือนนี้ขายเท่าไร | NO_DATA | Current-month plan ran; no Aug Sales rows |
| 8 | Sales Value เดือนนี้เท่าไร | FAIL_QUERY | SALES002 exists but no matched/executable value plan |
| 9 | GP เดือนนี้เท่าไร | FAIL_QUERY | SALES003/gp1 exists but no matched/executable GP plan |
| 10 | KMM03 เดือนนี้ขายกี่คัน | FAIL_MAPPING | Branch filter ignored; generic sales plan executed |
| 11 | Combine เดือนนี้ขายเท่าไร | FAIL_MAPPING | Product filter ignored; generic sales plan executed |
| 12 | TT เดือนนี้ขายกี่คัน | FAIL_MAPPING | Product filter ignored; generic sales plan executed |
| 13 | Tractor เดือนนี้ขายกี่คัน | FAIL_MAPPING | Product filter ignored; generic sales plan executed |
| 14 | ใครขายได้มากที่สุด | FAIL_MAPPING | Salesperson ranking was routed to generic monthly sales |
| 15 | ยอดขายเดือน 5 ปี 2023 เทียบกับปีนี้เป็นอย่างไร | PASS | SALES_YOY_COMPARE: 2023 10 vs 2026 17 units; +7 / 70% |
| 16 | Booking เดือนนี้กี่คัน | FAIL_INTENT | Thai/English phrase not in question library or alias mapping |
| 17 | เดือนนี้จองเท่าไหร่ | PASS | BOOKING_CURRENT_MONTH: 16 / 2,604,130,000 |
| 18 | ยอดจองเดือนนี้ | PASS | BOOKING_CURRENT_MONTH: 16 / 2,604,130,000 |
| 19 | Booking ปัจจุบัน | PASS | BOOKING_CURRENT_MONTH: 16 / 2,604,130,000 |
| 20 | จองเดือนนี้ | PASS | Booking alias matched current-month plan |
| 21 | KMM02 มี Booking เท่าไร | FAIL_INTENT | Branch query not mapped |
| 22 | Booking Cash มีกี่คัน | FAIL_INTENT | No payment-type field/value “Cash” exists; no intent |
| 23 | Product ไหน Booking สูงสุด | FAIL_INTENT | Product ranking plan is non-executable and phrase is unmapped |
| 24 | Booking เดือนนี้มูลค่าเท่าไร | FAIL_INTENT | BOOK002 exists but current value question is not routed |
| 25 | Booking เกิน 90 วันมีกี่คัน | PASS | BOOKING_AGING: 7 open rows; models/branches returned |
| 26 | Booking เกิน 90 วันมีรุ่นอะไรบ้าง | HALLUCINATION | Matched generic “เกิน 90 วัน” Stock alias and returned 35 Stock units, not Booking |
| 27 | Outstanding booking มีกี่คัน | FAIL_INTENT | No outstanding-status vocabulary/definition or route |
| 28 | ยอดจองปีนี้กี่คัน | FAIL_MAPPING | “จอง” alias runs current month, not year-to-date |
| 29 | Booking ของ KMM03 เดือนนี้กี่คัน | FAIL_INTENT | Branch-filter query not mapped |
| 30 | Salesperson ไหนมี Booking มากสุด | FAIL_INTENT | Salesperson ranking not mapped |
| 31 | Stock ปัจจุบันกี่คัน | FAIL_INTENT | STOCK_CURRENT plan is non-executable; phrase unmapped |
| 32 | สต็อกปัจจุบันกี่คัน | FAIL_INTENT | No Thai stock alias |
| 33 | คงเหลือกี่คัน | FAIL_INTENT | No inventory alias |
| 34 | CH เหลือกี่คัน | FAIL_INTENT | No CH alias/product-filter plan |
| 35 | Stock KMM03 เท่าไร | FAIL_INTENT | No Stock-by-branch plan |
| 36 | Stock อายุเกิน 90 วันกี่คัน | PASS | STOCK_AGING_MODEL: latest 2026-08-08 snapshot; 35 deduplicated units |
| 37 | Stock เกิน 90 วัน | PASS | Same verified Stock aging result |
| 38 | รถค้าง | PASS | Stock aging alias; same verified 35 units |
| 39 | รถอายุเกิน 90 วัน | PASS | Stock aging alias; same verified 35 units |
| 40 | รุ่นไหนมี Stock มากที่สุด | FAIL_INTENT | Model ranking plan is non-executable |
| 41 | Stock Value เท่าไร | FAIL_INTENT | STOCK002 exists, but no executable plan |
| 42 | aging stock | FAIL_INTENT | English aging phrase unmapped |
| 43 | สต็อกอายุเกิน 180 วัน | FAIL_MAPPING | Generic >90 Stock plan returned 35, not >180 scope |
| 44 | TT Stock เท่าไร | FAIL_INTENT | Product-filter plan absent |
| 45 | IM Stock เท่าไร | FAIL_INTENT | Product-filter plan absent |
| 46 | KMM03 ขาย Combine เดือนนี้กี่คัน | FAIL_MAPPING | Sales alias executed and ignored branch/product |
| 47 | Sales คนไหนขาย Tractor มากที่สุดปีนี้ | FAIL_MAPPING | Sales alias executed and ignored salesperson/product/year/ranking |
| 48 | KMM02 มี Booking Cash กี่คันเดือนนี้ | FAIL_INTENT | Branch/payment filtering unavailable; Cash is not verified source data |
| 49 | Stock CH อายุเกิน 90 วันใน KMM01 มีกี่คัน | FAIL_MAPPING | Stock aging plan ignored product and branch |
| 50 | KMM01 Stock TT อายุเกิน 90 วันเท่าไร | FAIL_MAPPING | Stock aging plan ignored product and branch |

Summary: PASS 10; PARTIAL 0; FAIL_INTENT 19; FAIL_MAPPING 12; FAIL_QUERY 2;
NO_DATA 6; HALLUCINATION 1. “FAIL” in the delivery summary is the 33
FAIL_INTENT + FAIL_MAPPING + FAIL_QUERY cases. Current **Phase 2A runtime**
database coverage, measured as correct responses over this 50-question
real-data suite, is 20%.

## 4. Coverage matrix

| Data Domain | Database Exists | KAI Can Query | Accuracy | Gap |
| --- | --- | --- | --- | --- |
| Sales | Yes: 3,376 rows; Unit, Value, GP, branch, model, salesperson | Limited: current month and one YoY form | 1 exact PASS; aliases can silently lose filters | YTD, value, GP, branch, product, salesperson, rankings |
| Booking | Yes: 398 rows; value, status, customer, branch, salesperson, product | Limited: current month and >90-day aging | 5 PASS; one Booking phrase returned Stock | Value, branch/product/salesperson/payment/outstanding |
| Stock | Yes: 748 rows, latest snapshot 2026-08-08 | Limited: KMM free-stock age >90 by model | 4 PASS | Current count/value, branch/product/model, other age thresholds |
| Target | Yes: 72 approved rows | No | N/A | No executable target / achievement / gap plan |
| GP | Yes: sales_transactions.gp1 | No | N/A | SALES003 has no executable plan |
| Branch | Yes: KMM01-03 in Operations and branches in Company D1 | Only as a Booking-aging output group | Partial | No branch filter/ranking; branch master is not on OPERATIONS_DB |
| Salesperson | Yes: 18 master rows and transaction fields | No | N/A | No join/ranking plan |
| Product | Yes: type and model fields in all transactions | Only hard-coded unit eligibility and aging output | Partial | No alias, type/model filter or ranking |
| Customer | Yes: booking customer/customer_name | No | N/A | No customer plan |

## 5. Phase 2B-02 recommendation (audit only)

### REUSE

- Reuse the authenticated /api/kai/query route, company context, parameterized
  JSON-plan DSL, dictionary validation, physical Stock de-duplication, and
  existing metrics/data dictionary.
- Reuse current verified unit eligibility and latest Stock snapshot scope.

### EXTEND

- Add executable, tested plans for Sales value, GP, YTD, branch/product/model/
  salesperson filters and rankings; Booking value, branch/product/salesperson
  filters/rankings and explicit outstanding definition; Stock current unit/value,
  branch/product/model filters/rankings, and age thresholds.
- Add parser support that extracts and applies filter values rather than letting
  generic aliases claim a richer question.
- Add a governed explicit source for branch master data if branch attributes
  beyond transaction branch codes are needed.

### FIX

- Prevent generic aliases from matching a question when unparsed constraints
  (year, branch, product, salesperson, ranking, payment type, age threshold)
  remain. This caused 12 wrong-scope answers.
- Give Booking-specific “Booking ... เกิน 90 วัน ...” precedence over the
  generic Stock alias. This caused the verified hallucination.
- Mark the 26 text-only templates unavailable to runtime until their plans exist,
  or implement their plans; their presence currently overstates coverage.
- Add explicit response state for a period with no rows; Sales Aug 2026 should
  say “no data” rather than only 0 and value N/A.

### MISSING DATA

- Payment type Cash is not a verified column/value. booking.purchase_status has
  A HOT, B HOT, Fail, S only.
- No authoritative customer payment-type or defined “outstanding booking” field
  was found. Do not infer either from status.

## 6. Validation and safety

| Check | Result |
| --- | --- |
| Existing regression | PASS — npm test: 311/311 PASS |
| TypeScript | PASS — npx tsc --noEmit |
| Build | PASS — npm test runs vinext build successfully |
| Production | UNCHANGED |
| Remote D1 | UNCHANGED |
| Source code | UNCHANGED |
