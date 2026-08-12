# KAI Phase 2A Business QA Fix

Status: `KAI_PHASE2A_BUSINESS_QA_PASS`

Test date: 2026-08-12

Environment: Local Operations D1 (`kmm-operations`), company `kmm-company`, timezone `Asia/Yangon`

## Scope

แก้ปัญหา Business QA ที่ทำให้คำถามเชิงธุรกิจบางประเภทถูก resolve ผิด intent หรือได้ผลลัพธ์ไม่ตรงกับ Dashboard โดยไม่สร้าง Chat UI ใหม่ ไม่เชื่อม LLM เพิ่ม และไม่ deploy Remote D1

## Fixes

| Issue | Fix | Result |
| --- | --- | --- |
| Generic alias claim richer questions | ตรวจ exact question และ rich business pattern ก่อน alias matching | Ranking/cross-metric questions ไปยัง handler ที่ถูกต้อง |
| Branch ranking ใช้ formatter ผิดโดเมน | จำกัด Sales branch ranking ให้ใช้เฉพาะ Sales | Sales, Booking และ Stock แยก domain ถูกต้อง |
| Legacy query template ไม่ executable | ส่งต่อด้วย `unsupported_question` ไปยัง deterministic business handler | ไม่แสดง error `not executable` |
| Stock Aging ไม่ตรง Dashboard | ใช้ latest `as_of_date`, physical-id dedupe และ Application Mapping ของ 08-TX classification | Local D1 = Dashboard: `35` คัน, snapshot `2026-08-08` |
| Month-over-Month scope ผิด | บังคับเดือนนี้เป็น primary scope และเดือนก่อนเป็น comparison scope | แสดง สิงหาคม 2026 เทียบ กรกฎาคม 2026 ถูกต้อง |

## Validation

| Check | Result |
| --- | --- |
| Safari business QA sample | `14/14 PASS` |
| Phase 2A focused tests | `20/20 PASS` |
| Existing build + regression suite | `291/291 PASS` |
| Runtime query lint | `PASS` |
| Local D1 migrations | `PASS` — no migrations remaining to apply |
| Production | `UNCHANGED` |
| Remote D1 | `UNCHANGED` — local migrations only |

## Browser QA highlights

- Sales / Booking / Stock branch ranking returned the requested domain.
- `Stock เกิน 90 วันมีรุ่นอะไรบ้าง` returned `35` units and the verified snapshot date.
- `สินค้าไหนมี Stock สูงแต่ยอดขายต่ำ` returned product-priority output with Sales, Booking, Stock, and Target evidence.
- `ยอดขายเดือนนี้เทียบเดือนที่แล้ว` returned Difference and Growth for August 2026 vs July 2026.
- Executive summary and baseline Sales, Booking, Stock, GP, aging, and comparison questions returned answers without runtime errors.

## Scope caveat

Booking current runtime (`16`) is the open-booking metric. Executive/branch summaries may show MTD Booking (`11`); these are different labeled scopes and are not silently mixed.

## Files

- `lib/kai/runtime-query.ts`
- `lib/kai/tools/kmm-business.ts`
- `drizzle/operations/0016_fix_kai_business_qa_scope.sql`
- `drizzle/operations/0017_reconcile_kai_stock_unit_mapping.sql`
- `tests/kai-phase2a-runtime.test.mjs`
- `tests/kai-stock-parity.test.mjs`

Recommendation: `READY FOR NEXT PHASE REVIEW`
