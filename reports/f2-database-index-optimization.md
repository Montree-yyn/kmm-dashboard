# F2 — Database Index Optimization (Performance Audit)

**Status:** DONE — applied locally, verified, tests green. **ไม่ commit / ไม่ deploy** รอ review

**Scope:** apply missing indexes เท่านั้น — ไม่แตะ business logic, ไม่แตะ API contract, ไม่แตะ data

---

## 1. WHAT WAS APPLIED

| ตาราง | Index | ครอบ query | Migration |
|---|---|---|---|
| `booking_transactions` | `booking_transactions_company_date_idx (company_id, booking_date)` | `listBookingTransactions` WHERE company_id ORDER BY booking_date | `0041` |
| `stock_transactions` | `stock_transactions_company_date_idx (company_id, as_of_date)` | `listStockTransactions` WHERE company_id ORDER BY as_of_date | `0041` |
| `booking_transactions` | `booking_transactions_company_import_idx (company_id, import_year, import_month)` | Data Hub re-import delete | `0041` |
| `stock_transactions` | `stock_transactions_company_import_idx (company_id, import_year, import_month)` | Data Hub re-import delete | `0041` |
| `sales_transactions` | `sales_transactions_company_date_idx (company_id, sale_date)` | `listSalesTransactions` WHERE company_id ORDER BY sale_date | `0042` (**ใหม่**) |

- Migration `0041` มีอยู่แล้วใน repo (งาน 1.2) แต่ยังไม่ apply ใน D1 ใดๆ — นำมา apply
- สร้าง `drizzle/operations/0042_operations_sales_date_index.sql` ใหม่ (additive, `IF NOT EXISTS`, มี rollback comment) — sales มีแค่ `sales_scope_invoice_idx (company_id, import_year, import_month, invoice_no)` ซึ่งไม่ครอบ ORDER BY sale_date
- Re-import delete ของ sales ครอบอยู่แล้วโดย prefix ของ `sales_scope_invoice_idx` → ไม่ต้องเพิ่ม import index ซ้ำ

**หมายเหตุการ apply:** local OPERATIONS_DB อยู่ที่ migration 0035 (0036–0040 เป็น agriculture migrations นอกขอบเขตงานนี้) — จึง apply เฉพาะ DDL ของ 0041+0042 ลง local D1 โดยตรง **ไม่แตะตาราง `d1_migrations`** (DDL เป็น idempotent → wrangler apply จริงในอนาคตจะ no-op ปลอดภัย)

---

## 2. BEFORE / AFTER — EXPLAIN QUERY PLAN

company_id = `kmm-company` (3417 sales / 407 booking / 749 stock rows)

### sales — `WHERE company_id=? ORDER BY sale_date ASC`
| | Query plan | avg (3 runs) |
|---|---|---|
| BEFORE | `SEARCH USING INDEX sales_scope_invoice_idx (company_id=?)` + **`USE TEMP B-TREE FOR ORDER BY`** | 11.84 ms |
| AFTER | `SEARCH USING INDEX sales_transactions_company_date_idx (company_id=?)` — **no sort step** | 8.99 ms |

### booking — `WHERE company_id=? ORDER BY booking_date ASC`
| | Query plan | avg |
|---|---|---|
| BEFORE | **`SCAN booking_transactions`** + `USE TEMP B-TREE FOR ORDER BY` | 1.53 ms |
| AFTER | `SEARCH USING INDEX booking_transactions_company_date_idx (company_id=?)` — **no sort step** | 1.17 ms |

### stock — `WHERE company_id=? ORDER BY as_of_date ASC`
| | Query plan | avg |
|---|---|---|
| BEFORE | **`SCAN stock_transactions`** + `USE TEMP B-TREE FOR ORDER BY` | 2.21 ms |
| AFTER | `SEARCH USING INDEX stock_transactions_company_date_idx (company_id=?)` — **no sort step** | 1.81 ms |

### Data Hub re-import delete — `WHERE company_id=? AND import_year=? AND import_month=?` (ALL SEARCH now)
- sales → `sales_scope_invoice_idx` ✅ (เดิมก็ครอบ)
- booking → `booking_transactions_company_import_idx` ✅ (เดิม SCAN)
- stock → `stock_transactions_company_import_idx` ✅ (เดิม SCAN)

**Key win:** full scan → index seek + **temp b-tree sort หายไปทุก query** (sort ผ่าน index โดยตรง)

---

## 3. FILES CHANGED

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `drizzle/operations/0042_operations_sales_date_index.sql` | **ใหม่** — sales (company_id, sale_date) index, additive |
| `tests/operations-indexes-regression.test.mjs` | +2 tests ครอบ 0042 (index DDL + additive-only) |

ไม่แตะ: repository / routes / schema.ts / business logic / API contract / data

---

## 4. TEST RESULTS

| Gate | ผล |
|---|---|
| `node --test tests/operations-indexes-regression.test.mjs` | ✅ 4/4 |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm test` (full suite) | ✅ **379/379 pass** (ก่อนหน้า 377 + 2 ใหม่) |

---

## 5. NEXT STEPS (รอ approval)

- apply migration 0041+0042 ผ่าน wrangler ไปยัง staging (`wrangler d1 migrations apply kmm-operations --remote --config wrangler.staging.jsonc`) — **ต้องทำเมื่อได้อนุมัติ + หลัง verify 0036–0040** (งานนี้ apply เฉพาะ local)
- ต่อ F3 (marketing ย้ายไป API/pmtiles) / F1 (server-side aggregation) ตามลำดับใน audit report

**READY_FOR_REVIEW = YES**
