# KAI Phase 2B-02 — Executable Query Coverage Upgrade

Date: 2026-08-13. Scope: local repository and Local Miniflare D1 only.
Production and Remote D1 were not accessed, changed, or deployed.

## Outcome

| Measure | Before | After |
| --- | ---: | ---: |
| Executable KAI query templates | 5 / 31 | 34 / 34 |
| Real-data coverage suite | 10 / 50 PASS (20%) | 50 / 52 PASS (96.15%) |
| Hallucinations | 1 | 0 |

The two non-PASS cases are correct verified unavailable responses:

- Booking Cash มีกี่คัน → no Cash payment-type value/definition exists in
  the verified Booking schema or source data.
- Outstanding booking มีกี่คัน → no authoritative Outstanding Booking
  definition exists.

Neither query falls through to Stock or a general model.

## Implementation

### Executable plans

drizzle/operations/0018_kai_phase2b_executable_query_coverage.sql converts
every original text-only plan into a version-2 JSON executable plan and adds:

- TARGET_CURRENT_QUERY
- CUSTOMER_BOOKING_QUERY (distinct-customer aggregate only; names are not
  returned)
- SALES_PERSON_RANKING

Every source/field is from audited local Operations D1:

| Domain | Verified sources used |
| --- | --- |
| Sales / GP / Salesperson | sales_transactions.sale_date, branch, model, product_type, quantity, final_received, gp1, salesperson_name |
| Booking / Customer | booking_transactions.booking_date, branch, product_type, product_model, booking_price, status, purchase_status, customer_name |
| Stock | stock_transactions.as_of_date, branch, product_type, product_model, msrp, stock_status, kmm_flag, stock_age_days, physical identifiers |
| Target | business_targets.target_year, target_month, metric, target_value, product_group, approval_status |

lib/kai/runtime-query-v2.ts uses a fixed operation allow-list, quoted
server-owned identifiers, and bound parameters. User questions never become
SQL.

### Constraint parser and safety

The runtime now parses and applies:

- company: authoritative server context only
- branch: only Company-context Branch Master codes for the authorized company
- product group: verified per-domain source codes
- model: exact case-insensitive source-field filter
- explicit year and month
- salesperson: exact case-insensitive transaction field filter
- verified Booking purchase statuses: A HOT, B HOT, Fail, S

Cash and Outstanding are deliberately unavailable. Generic เกิน 90 วัน was
removed from the alias table, and Booking-aging detection has precedence over
Stock. This removes the Phase 2B-01 Booking-to-Stock hallucination.

### COMPANY_DB integration

No Branch Master was duplicated into Operations D1. requireCompanyContext()
already resolves context.branches from COMPANY_DB after authentication,
membership, company selection, and view permission checks. The query route
passes only branch code/name vocabulary into the runtime. Transaction queries
still run only against OPERATIONS_DB with the authorized companyId.

## Tests

tests/kai-phase2b-coverage.test.mjs validates:

- all 34 stored plans are executable version-2 JSON
- 50 database-backed questions across Sales, Booking, Stock, GP, Target,
  Customer, Salesperson, combinations, and paraphrases
- branch/product/year/month/salesperson filter results from real local data
- Cash and Outstanding are explicit unavailable results, never Stock answers

Representative verified combinations:

| Question | Result |
| --- | --- |
| KMM03 ขาย Combine เดือนกรกฎาคม 2026 กี่คัน | 7 units |
| Stock CH อายุเกิน 90 วันใน KMM01 มีกี่คัน | 10 units |
| Salesperson 02-Aung Bo Bo เดือนกรกฎาคม 2026 ขายกี่คัน | 5 units |
| เดือนกรกฎาคม 2026 มีลูกค้าจองกี่ราย | 45 distinct customers |

## Validation

| Check | Result |
| --- | --- |
| Phase 2B coverage tests | PASS — 3/3 tests; 50 PASS, 2 NO_DATA, 0 hallucinations |
| Existing regression | PASS — 311/311 |
| TypeScript | PASS — npx tsc --noEmit |
| Build | PASS — vinext build through npm test |
| Local D1 | PASS — migration 0018 applied; 34/34 executable plans |
| Production | UNCHANGED |
| Remote D1 | UNCHANGED |

## Remaining gaps

1. Cash payment type and Outstanding Booking cannot be implemented until a
   verified source field/value and business definition are supplied.
2. Product-code contracts differ by domain (notably Stock EX/TP and the
   existing 08-TX application mapping), so future new groups must be added
   only with an audited mapping.
3. Current target data is constrained to approved source scope; absent target
   rows return no target rather than an inferred value.
