# KAI Phase 2B-04 — Full Database Business Coverage

Audit date: 2026-08-13 (Local D1 only). The audit used the actual D1 schema, local rows, import/runtime code, Dashboard stock selectors, and KAI knowledge records. It excludes the two Miniflare `_cf_METADATA` tables and SQLite's internal `sqlite_sequence`; that leaves the requested 37 application tables.

## Architecture result

- `OPERATIONS_DB` remains the only authority for Sales, Booking, Stock, Target, and Salesperson transactions/master data.
- `COMPANY_DB` remains the only authority for Branch and Company Master data. KAI now receives it as a separate optional binding only after `requireCompanyContext(... permission: "view")` succeeds; no Branch Master was copied into `OPERATIONS_DB`.
- Every plan is fixed version-2 JSON. The runtime owns table names, SQL grammar, and bound parameters. It has no user-generated SQL path and executes read-only `SELECT` statements.

## 1. Full table classification

`CURRENT` below means implemented in the Phase 2B-04 runtime. `Legacy mirror` means a copy exists in `COMPANY_DB`, but the active architecture designates the Operations copy as authoritative and KAI never reads the mirror.

| Table | Classification | Purpose / important fields | Relationship | Current KAI support | Permission scope | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| `COMPANY_DB.audit_logs` | AUDIT_LOG | action, entity, old/new value, user_id, company_id | company/user activity trail | No | Admin/audit only | Keep out of business Q&A. |
| `COMPANY_DB.booking_transactions` | NOT_RELEVANT | Legacy mirror: booking_date, customer, product, status, booking_price | Duplicate of Operations Booking source | No | N/A | Do not query or synchronize for KAI. |
| `COMPANY_DB.branches` | MASTER_DATA | branch_code, branch_name, region, township, status, company_id | company_id → company; referenced logically by operational branch code | Yes: active branch directory | Authorized company + `view`; only code/name/region/township | Keep as the sole Branch authority. |
| `COMPANY_DB.business_targets` | NOT_RELEVANT | Legacy mirror: target period, metric, value, scope, approval | Duplicate of Operations Target source | No | N/A | Do not query or synchronize for KAI. |
| `COMPANY_DB.companies` | MASTER_DATA | company_name/code, business_type, industry, established_year, status | company_id root | Yes: safe profile subset | Authorized company + `view` | Keep sensitive contact/tax fields excluded. |
| `COMPANY_DB.company_currencies` | MASTER_DATA | primary/display currency, symbol, decimals, number format | company_id → company | Yes | Authorized company + `view` | Return only display configuration. |
| `COMPANY_DB.company_localizations` | MASTER_DATA | language, timezone, date/time format, first day | company_id → company | Yes | Authorized company + `view` | Used as configuration only. |
| `COMPANY_DB.company_setting_drafts` | SYSTEM_INTERNAL | JSON payload, revision, draft status | company_id → company | No | Company admin only | Never use draft JSON as a business definition. |
| `COMPANY_DB.company_users` | SECURITY | user_id, email, role, status, company_id | membership/role → company | Indirect only | Auth subsystem | Never return membership data through KAI. |
| `COMPANY_DB.d1_migrations` | SYSTEM_INTERNAL | migration metadata | D1 implementation | No | System | Exclude. |
| `COMPANY_DB.daily_management_inputs` | NOT_RELEVANT | Legacy JSON payload copy | Legacy mirror, not Operations authority | No | N/A | Do not query for KAI. |
| `COMPANY_DB.data_column_mappings` | NOT_RELEVANT | Legacy import mapping copy | Legacy mirror | No | N/A | Do not query for KAI. |
| `COMPANY_DB.data_import_history` | NOT_RELEVANT | Legacy import history copy | Legacy mirror | No | N/A | Do not query for KAI. |
| `COMPANY_DB.departments` | MASTER_DATA | department_code/name, branch_id, users, status | company_id → company; branch_id logical → branch | Safe NO_DATA when empty | Authorized company + `view` | Query only active, non-sensitive directory fields. |
| `COMPANY_DB.fiscal_years` | MASTER_DATA | fiscal_year_name, start/end month/day, current flag | company_id → company | Yes | Authorized company + `view` | Return stored dates only; do not infer fiscal periods. |
| `COMPANY_DB.holidays` | MASTER_DATA | holiday_name/date/type, repeat flag, branch_id, status | company_id → company; branch_id logical → branch | Safe NO_DATA when empty | Authorized company + `view` | Return active stored entries only. |
| `COMPANY_DB.sales_transactions` | NOT_RELEVANT | Legacy mirror: sale date, product, quantities, values | Duplicate of Operations Sales source | No | N/A | Do not query or synchronize for KAI. |
| `COMPANY_DB.salesperson_master` | NOT_RELEVANT | Legacy mirror: person code/name/status | Duplicate of Operations Salesperson master | No | N/A | Do not query or synchronize for KAI. |
| `COMPANY_DB.stock_transactions` | NOT_RELEVANT | Legacy mirror: stock snapshot, physical IDs, age/value | Duplicate of Operations Stock source | No | N/A | Do not query or synchronize for KAI. |
| `COMPANY_DB.working_calendars` | MASTER_DATA | working/weekend days, start/end time, status | company_id → company | Yes | Authorized company + `view` | Parse stored JSON arrays only. |
| `OPERATIONS_DB.booking_transactions` | BUSINESS_QUERYABLE | booking_date/no, branch, product type/model, status, purchase_status, booking_price, deposit_amount, salesperson, customer_name | company_id → authorized company; branch/person logical masters | Yes: unit/value, deposit, lifecycle/purchase status, salesperson/model/branch ranking, aging, aggregate customer count | Authorized company; no customer-name output | Keep Cash/Outstanding unsupported pending definition. |
| `OPERATIONS_DB.business_targets` | BUSINESS_QUERYABLE | target_year/month, metric, value, product_group, branch_id, salesperson_id, approval, effective/version | company_id → authorized company; compared to Sales | Yes: Unit/Revenue/GP Target, actual, achievement, gap | Authorized company; only approved full-month company scope | Do not infer branch/salesperson targets. |
| `OPERATIONS_DB.d1_migrations` | SYSTEM_INTERNAL | migration metadata | D1 implementation | No | System | Exclude. |
| `OPERATIONS_DB.daily_management_inputs` | UNVERIFIED | draft/published JSON payload | company_id logical | No | Company workflow | Empty local source and no stable field definition; keep unsupported. |
| `OPERATIONS_DB.data_column_mappings` | SYSTEM_INTERNAL | import mapping JSON | import pipeline configuration | No | Admin/import | Do not treat mappings as business facts. |
| `OPERATIONS_DB.data_import_history` | AUDIT_LOG | module, source file, row counts, status, importer, timestamps | company/import lineage | No | Admin/import | Keep out of business Q&A. |
| `OPERATIONS_DB.kai_alias_mapping` | SYSTEM_INTERNAL | alias, canonical term, intent | KAI knowledge metadata | Indirect only | System | Runtime parser remains server-owned. |
| `OPERATIONS_DB.kai_business_rules` | SYSTEM_INTERNAL | verified rule text/scope | KAI knowledge metadata | Indirect only | System | Source of auditability, not a user data domain. |
| `OPERATIONS_DB.kai_data_dictionary` | SYSTEM_INTERNAL | field definition and domain | KAI knowledge metadata | Indirect only | System | Source of auditability, not a user data domain. |
| `OPERATIONS_DB.kai_history` | AUDIT_LOG | question, intent, answer, feedback | KAI conversation audit | No | Audit only | Do not expose prompt history. |
| `OPERATIONS_DB.kai_metrics` | SYSTEM_INTERNAL | metric definition/formula/scope | KAI knowledge metadata | Indirect only | System | Keep read by runtime only. |
| `OPERATIONS_DB.kai_query_templates` | SYSTEM_INTERNAL | intent, fixed executable plan | KAI knowledge metadata | Indirect only | System | Keep plans fixed and versioned. |
| `OPERATIONS_DB.kai_question_library` | SYSTEM_INTERNAL | sample question, intent, metric | KAI knowledge metadata | Indirect only | System | Keep as routing evidence. |
| `OPERATIONS_DB.kai_response_templates` | SYSTEM_INTERNAL | response structure | KAI knowledge metadata | Indirect only | System | Keep as output contract. |
| `OPERATIONS_DB.sales_transactions` | BUSINESS_QUERYABLE | sale_date, branch, product/model, quantity, final_received, gp1, expense, salesperson | company_id → authorized company; salesperson logical master | Yes: unit/value/GP/expense, comparison and ranking | Authorized company | Keep raw `sale_amount`/`net_received` out until business definition is approved. |
| `OPERATIONS_DB.salesperson_master` | MASTER_DATA | employee_code, salesperson_code/name, status | company_id → authorized company; used to canonicalize Sales aliases | Yes: directory and verified Salesperson filter | Authorized company | Resolve title/ordinal-only alias only when unique master match exists. |
| `OPERATIONS_DB.stock_transactions` | BUSINESS_QUERYABLE | as_of_date, branch, product type/group/model, KMM flag, status, physical IDs, msrp, stock_age_days | company_id → authorized company; same selector contract as Dashboard | Yes: unit/value, aging, model/branch ranking | Authorized company | Retain Dashboard Free Stock/KMM/physical-ID rules. |

Classification totals: BUSINESS_QUERYABLE **4**; MASTER_DATA **9**; SYSTEM_INTERNAL **11**; SECURITY **1**; AUDIT_LOG **3**; UNVERIFIED **1**; NOT_RELEVANT **8** = **37**.

## 2. Field-level verification and handling

Only meanings proven from schema plus import/business/runtime code and Local D1 samples are labelled verified. Raw/staging fields and identifiers that have no approved user-facing business definition are intentionally excluded from calculations.

| Asset | Verified business fields / evidence | KAI handling |
| --- | --- | --- |
| Sales | `sale_date`, `branch`, `product_type`, `model`, `quantity`, `final_received`, `gp1`, `expense`, `salesperson_code/name`; `lib/sales/business-service.ts` establishes Units, Value=`final_received`, GP=`gp1`, and Expense legacy scope | Supported with company/branch/product/model/year/month/salesperson filters. GP/Expense refuse incomplete source values. `sale_amount` and `net_received` remain unverified raw values. |
| Booking | `booking_date/no`, branch fields, `product_type/model`, `booking_price`, `deposit_amount`, canonical `status`, `purchase_status`, salesperson fields, `customer_name`; verified by import adapter and samples | Supported. Deposit is explicitly **Recorded Deposit** and reports missing source count; blank is never treated as zero. Customer is aggregate count only; customer names are not returned. |
| Stock | `as_of_date`, branch fields, `product_type/group/model`, `kmm_flag`, `stock_status`, physical identifiers, `msrp`, `stock_age_days` | Supported through `lib/dashboard/stock-selectors.ts`: latest snapshot, Free Stock, KMM ownership, physical-ID de-duplication, dashboard unit/value product rules, age range. Raw `quantity` is not substituted for physical-unit count. |
| Target | `target_year/month`, `metric`, `target_value`, `product_group`, `approval_status`, `effective_from`, `updated_at`, `source_version`, branch/salesperson scope | Supported for approved calendar-month Unit, Revenue, and GP targets. Latest source version is selected per month. Branch/salesperson scope is refused because verified Local rows are company-wide only. |
| Salesperson Master | `salesperson_code`, `salesperson_name`, `status`; import route uses it to canonicalize Sales rows | Supported as directory and Sales filter. Formatting-only alias normalization is accepted only for one unique master identity. |
| Branch Master | `branch_code`, `branch_name`, `region`, `township`, `status`; `requireCompanyContext` loads vocabulary from Company DB | Supported through separate Company binding. Blank location returns “not registered”, not an invented location. |
| Company Profile/Currency/Localization | Active profile subset, display currency/symbol/format, language/time zone/formats | Supported through one fixed Company Master executor; sensitive fields are excluded. |
| Fiscal/Working Calendar | Stored fiscal start/end, current flag, working/weekend JSON, start/end time | Supported as stored records only. |
| Departments/Holidays | Active directory/holiday schema is verified but Local D1 currently has no active rows | Safe `NO_DATA`; KAI never invents a department or holiday. |

## 3. KAI coverage matrix

| Domain | Available in DB | Verified definition | KAI query supported | Filters | Aggregation / ranking | Permission safe | Remaining gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sales Unit / Value | Yes | Unit uses approved codes; Value=`final_received` | Yes | company, branch, product, model, year/month, salesperson | sum, comparison, ranking | Yes | Raw amount/net received not approved metrics. |
| GP | Yes | `gp1`, only when complete | Yes | Same Sales filters | sum; Target comparison | Yes | No partial GP total. |
| Sales Expense | Yes | `expense` in verified legacy value-product scope | Yes | Same Sales filters | sum | Yes | Incomplete scope returns `NO_DATA`. |
| Booking Unit / Value | Yes | row count / `booking_price` | Yes | company, branch, product/model, year/month, salesperson, lifecycle, purchase status | sum, ranking, comparison | Yes | No inferred payment type. |
| Booking Deposit | Yes | Stored `deposit_amount` only | Yes | Same Booking filters | recorded sum + missing count | Yes | Not a reconciled total where blanks exist. |
| Booking Status / Purchase Status | Yes | Canonical lifecycle status and imported purchase status | Yes | Same Booking filters | breakdown/ranking | Yes | No Cash mapping. |
| Customer | Booking only | Distinct nonblank `customer_name` in Booking | Yes, aggregate only | Booking scope | count only | Yes; no PII names | Customer Sales/Delivery relationship absent. |
| Stock | Yes | Dashboard current-stock selector contract | Yes | company, branch, normalized product/model, latest/explicit snapshot period | unit/value, aging, model/branch ranking | Yes | Unmapped raw product codes stay unavailable. |
| Sales Unit Target | Yes | Approved monthly `SALES_UNITS`, optional TT/CH/EX_TP scope | Yes | company, product, full month/year/quarter | target/actual/achievement/gap | Yes | No branch/salesperson target rows. |
| Revenue / GP Target | Yes | Approved monthly `SALES_REVENUE` / `GP1`, company-wide | Yes | company, full month/year/quarter | target/actual/achievement/gap | Yes | Product/branch/person scope unavailable. |
| Salesperson Master | Yes | Operations master code/name/status | Yes | company, exact code/name | list/count | Yes | No unverified fuzzy identity match. |
| Branch Master | Yes | Company Master active branch rows | Yes | company, branch | list/count | Yes | Region/township are blank locally. |
| Company Configuration | Yes | Active Company Master rows | Yes | company | summary/list | Yes | Sensitive profile fields excluded. |
| Department / Holiday | Schema yes, Local active rows absent | Active master rows only | Safe `NO_DATA` | company | list | Yes | Source data must be created first. |
| Marketing / Commission / Delivery / Receive Date | No verified queryable source | No table/field/business rule found | No | N/A | N/A | Yes | Keep unsupported. |

Verified business query coverage: **100% (54/54 executable, permission-safe plan capabilities in the verified business scope)**. The denominator excludes SECURITY, AUDIT_LOG, SYSTEM_INTERNAL, legacy mirrors, empty/untyped drafts, raw fields without an approved business definition, and intentionally PII-restricted detail fields.

## 4. Product-code audit

Verified mappings used by KAI:

- Sales: `01-TT`=TT, `02-CH`=CH, `03-TP`=TP, `04-EX`=EX, `06-IM`=IM, `07-IMO`=IMO, `08-OT`=OT.
- Booking: `01-TT`=TT, `02-CH`=CH, `04-EX`=EX.
- Stock: `01-TT`=TT, `02-CH`=CH, `03-EX`=EX, `04-TP`=TP, `06-IM`=IM, `07-IMO`=IMO. Raw `08-TX` is only classified as TT when the already-approved Dashboard model fallback matches `NSPU`/`MU`/`M`/`L`/`B` patterns.

Unresolved and deliberately unavailable:

- `05-TX`: Local Sales rows contain incompatible models, so no single product-group mapping is justified.
- `MITSU`: Source value exists but is not a canonical KMM product group.
- Direct raw `08-TX`: its model-conditional Dashboard treatment is not a universal raw-code mapping.

## 5. Definitions that remain unavailable

- **Cash Payment Type: UNSUPPORTED.** Source aliases mention payment input concepts, but no persisted Operations field plus approved business rule defines Cash.
- **Outstanding Booking: UNSUPPORTED.** No field or verified calculation rule exists.
- **Customer Sales: UNSUPPORTED.** Customer is verified only in Booking; Sales has no customer relationship. A customer-sales question returns an explicit unavailable result rather than an unfiltered Sales answer.

## 6. Validation and result

`tests/kai-phase2b-coverage.test.mjs` executes all plan domains against Local D1, including field combinations, aliases, temporal range, ranking, ambiguity, unsupported definitions, and Company DB isolation.

| Measure | Result |
| --- | --- |
| Coverage cases | **274** total |
| PASS | **261** database-backed answers |
| NO_DATA | **7** (incomplete Expense, unavailable granular/partial Target, empty Department/Holiday) |
| UNSUPPORTED | **6** (Cash, Outstanding, Customer Sales, `05-TX`, direct `08-TX`, `MITSU`) |
| FAIL | **0** |
| HALLUCINATION | **0** |
| Coverage before | 151/151 Phase 2B-03 baseline; 34 executable plans |
| Coverage after | 274/274 classified cases; 54/54 executable plans |
| Existing regression | 311/311 PASS (validated in final suite) |
| TypeScript | PASS — `npx tsc --noEmit` |
| Build | PASS — `npm test` build step |
| Local D1 | PASS — migrations `0019`, `0020`; 54/54 executable plans |
| Production | UNCHANGED |
| Remote D1 | UNCHANGED |

### Final capability status

- GP: **SUPPORTED**
- Target: **SUPPORTED** (company-wide approved full-month scope only)
- Customer: **SUPPORTED** for Booking aggregate; **Customer Sales UNSUPPORTED**
- Salesperson: **SUPPORTED**
- Branch filtering: **PASS**
- Product/model filtering: **PASS**
- Year/month filtering: **PASS**
- COMPANY_DB integration: **PASS** — separate read-only binding, context first, no master duplication

### Remaining gaps

1. Cash Payment Type and Outstanding Booking need a persisted source field plus an approved business definition.
2. `05-TX`, `MITSU`, and direct raw `08-TX` need a source-backed canonical product mapping.
3. Customer Sales/Delivery, Marketing, Commission, and Receive Date need verified relationships or fields; Department/Holiday need Local source rows.

## Completion

**KAI_PHASE2B_04_FULL_DATABASE_COVERAGE_COMPLETE**

Phase 2B Definition of Done: **PASS**

Ready for Phase 2B Final Audit: **YES**
Commit: repository HEAD at delivery (reported in the final handoff)
