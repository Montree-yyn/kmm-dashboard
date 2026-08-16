# KMM Deep-Dive: P0/P1 Findings — Impact Analysis & Fix Proposal

- **Date:** 2026-08-15 · **Mode:** Static only — no code changes, proposals only
- **Scope:** E1 (booking age hardcode) · E2 (product-type classification) · E3 (targets not wired to UI)
- **Evidence base:** `lib/dashboard/booking-selectors.ts`, `lib/dashboard/stock-selectors.ts`, `lib/sales/business-service.ts`, `lib/dashboard/product-groups.ts`, `lib/kai/runtime-query-v2.ts`, `lib/kai/executive-intelligence.ts`, `lib/targets/*`, `app/api/sales/route.ts`, `app/api/operations/route.ts`, `components/booking/booking-intelligence-page.tsx`, `components/dashboard/dashboard-page.tsx`, `components/sales/sales-page.tsx`, real data in `public/dashboard-data.json` + `public/data-import-report.json`.

---

# E1 — Booking Age ถูกแช่แข็งที่วันที่ตายตัว (P0)

## 1. ปัญหา (Evidence)

`lib/dashboard/booking-selectors.ts:72`

```ts
export function bookingAge(row: BookingRow, asOf = new Date("2026-07-11T00:00:00")) {
  const date = new Date(`${row.date}T00:00:00`);
  const days = Math.floor((asOf.getTime() - date.getTime()) / 86_400_000);
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}
```

- `bookingAge()` มี default `asOf` = **11 ก.ค. 2026** แบบ hardcode
- `getAverageBookingAge()` (บรรทัด 73) เรียก `bookingAge(row)` **โดยไม่ส่ง asOf** → ใช้ค่าวันที่ตายตัวเสมอ
- scan ทั้ง repo: **เป็น hardcode date จุดเดียวใน codebase** (ไม่มีจุดอื่น)
- Call chain ที่ถูก freeze:
  - `components/booking/booking-intelligence-page.tsx:162` → `age(row) = bookingAge(row)` → ใช้ใน: KPI "Average Booking Age" (ผ่าน `getOperationalBusiness`), health buckets (`risk()`), heatmap aging, "Management Follow-Up" (`age(r) > 90`), export CSV, ตาราง detail คอลัมน์ "Booking Age"
  - `lib/operations/business-service.ts:15` → `averageAge: getAverageBookingAge(...)` → `/api/operations` payload
  - Dashboard attention panel ใช้แค่ `getOpenBookingUnit` (count) → **ไม่ได้รับผล** · KAI executive intelligence ใช้แค่ units/value → **ไม่ได้รับผล**

## 2. Impact

- วันนี้ (15 ส.ค. 2026) ทุก booking มีอายุถูกคิดเป็น **ต่ำกว่าความเป็นจริง ~35 วัน** และจะล้าสมัยไปทุกวัน
- ผลลูกโซ่บนหน้า Booking:
  - อายุเฉลี่ย (KPI) ต่ำเกินจริง
  - Bucket health ผิด: booking ที่ควรเป็น ">90 วัน / Critical" ยังแสดง "61–90 / At Risk" → **รายการ escalate (`age > 90`) หายไป**, heatmap กระจายผิด
  - CSV export อายุผิด → ข้อมูลที่ operator ส่งออกไปไม่ตรงความจริง
- **Severity:** สูง — เป็น reporting-integrity bug ที่เกิดขึ้นจริงในวันนี้ ไม่ใช่ความเสี่ยงอนาคต → P0

## 3. Root cause

- ค่า "วันนี้" ถูกฝังใน selector แทนที่จะไหลมาจาก caller
- ไม่มี parameter `asOf` ที่บังคับ → caller ละเลยได้โดย compiler ไม่จับ

## 4. Fix Proposal (ไม่แก้โค้ดในรอบนี้)

**เป้า:** อายุ booking ต้องคำนวณจาก "business today" ที่เป็นทางการเพียงแหล่งเดียว และ compiler บังคับให้ส่งค่านั้น

1. **ทำให้ `asOf` เป็น required (breaking change ตั้งใจ)**
   - `bookingAge(row, asOf: Date)` — ตัด default ออก
   - `getAverageBookingAge(rows, filters, asOf)` — เพิ่มพารามิเตอร์
   - TypeScript จะบังคับให้ caller ทุกจุดส่งค่า → หมดช่องว่างแบบนี้ถาวร

2. **กำหนดแหล่ง "business today" เพียงแหล่งเดียว**
   - ตัวเลือกที่แนะนำ: **คำนวณฝั่ง server** — `/api/operations` รู้ company time zone อยู่แล้ว (`Asia/Yangon` / `Asia/Bangkok` จาก company context)
     - Server คำนวณ `averageAge` สำเร็จรูป และเพิ่ม `ageDays` ต่อแถวใน adapter payload
     - Client แค่ render — ลดการพึ่งพา client clock (ซึ่ง user อาจตั้งผิด/ต่าง timezone)
   - Fallback สำหรับ client-side (ถ้าจำเป็น): ใช้ `new Date()` ที่ company time zone และส่งลง selector ทุกจุด

3. **ความละเอียดเวลา**
   - `bookingDate` ไม่มี timezone (เป็นแค่วัน) → คำนวณอายุแบบ date-only (ปัด floor) ตามวิธีปัจจุบัน แต่เทียบกับ "วันนี้" ใน time zone ของบริษัท ไม่ใช่ UTC/literal

4. **Edge cases (คงพฤติกรรมเดิม)**
   - อายุลบ → clamp เป็น 0 (booking ในอนาคต)
   - `date` parse ไม่ได้ → 0 (ปัจจุบัน) หรือพิจารณาเป็น `null` เพื่อให้ N/A แทน 0 — ควรตัดสินใจกับทีม (0 อาจกลบข้อมูลเสีย)

5. **Tests**
   - Unit: `bookingAge(row, asOf)` ต้องเพิ่มขึ้นเมื่อ `asOf` เลื่อน; ถูกต้องที่ boundary (30/31/60/90/91 วัน)
   - Regression: KPI อายุเฉลี่ยของ fixture เดิมต้องเปลี่ยนตาม asOf ที่ inject
   - Contract: `/api/operations` ต้องคืน `ageDays` + `averageAge` ที่ server คำนวณ

---

# E2 — Product-Type Classification ไม่สอดคล้องกันข้ามโมดูล (P1)

## 1. ปัญหา (Evidence — รวมข้อมูลจริง)

**ข้อมูลจริงจาก workbooks (public/dashboard-data.json):**

| Module | รูปแบบ code ที่พบจริง |
|---|---|
| Sales (3,474 rows) | `01-TT` `02-CH` `03-TP` `04-EX` `06-IM` `07-IMO` `08-OT` + junk: `?` (159), `05-TX` (4), `MITSU` (1) |
| Booking (307 rows) | `TT` `CH` `EX` (plain codes เท่านั้น) |
| Stock (281 rows) | `01-TT` `02-CH` **`03-EX`** **`04-TP`** `06-IM` `07-IMO` + junk: `08-TX` (3) |

**มี 4 ตาราง mapping คู่ขนาน:**

1. `lib/sales/business-service.ts:15-30` `SALES_PRODUCT_TYPE_GROUPS` — exact match, **EX=`04-EX`, TP=`03-TP`**
2. `lib/dashboard/booking-selectors.ts:27-42` `PRODUCT_ALIASES` — strip อักษร, **EX=`04EX`, TP=`03TP`** (ไม่มี numeric IM/IMO/OT)
3. `lib/dashboard/stock-selectors.ts:26-38` `aliases` — **EX=`03EX`, TP=`04TP`** (มี `06IM`/`07IMO`/`08OT`)
4. `lib/kai/runtime-query-v2.ts:100-104` `PRODUCT_CODES` — ตาราง KAI แยกต่อโมดูล: sales EX=`04-EX`/TP=`03-TP` แต่ stock EX=`03-EX`/TP=`04-TP` (รับรองความต่างนี้ใน KAI ด้วย)

**+ ฟังก์ชันที่ 5:** `lib/dashboard/product-groups.ts:13` `productCategory()` — substring match บน `type + model` (ใช้แสดงผลหน้า Booking + `isUnitProduct`)

**สรุป:** EX/TP มี code ต่างกันระหว่าง Sales กับ Stock ("04-EX"/"03-TP" vs "03-EX"/"04-TP") — ข้อมูลจริงยืนยันว่าทั้งสองชุดต่างมีอยู่ในระบบ และแต่ละโมดูลก็ map ตาม convention ของตัวเอง

## 2. Impact

**อันตรายหลักคือ "silent wrongness" — ไม่มี validation จุดใดเช็คว่า code ใหม่/เปลี่ยน convention:**
- ถ้า stock workbook เริ่มใช้ `04-EX` (เหมือน sales) → stock-selector classify เป็น **Unknown** → สต็อก EX หายจากทุก breakdown, stock-vs-booking gap chart แสดง EX shortage ผิด, KAI ตอบ EX stock ผิด — **โดยไม่มี error แจ้งใคร**
- มีหลักฐาน drift อยู่แล้ว: booking alias ไม่มี numeric IM/IMO/OT (`06IM`…) ในขณะที่ stock/sales มี → ถ้า booking workbook เพิ่มรหัสดังกล่าวจะหลุดทันที
- `productCategory` (substring) อาจ classify ผิดจาก model text (เช่น model ที่มี "TT"/"IM" แทรก) และต่างจาก normalize ตัวอื่น → หน้า Booking แสดง product ต่างจาก breakdown/KAI
- Junk codes ถูกจัดการไม่เหมือนกัน: sales `05-TX`/`MITSU` → "Other", stock `08-TX` → "Unknown", KAI → ตอบ "canonical product mapping unavailable" — ผู้ใช้เห็นพฤติกรรมต่างกันต่อ code เดียวกัน
- บำรุงรักษา: mapping 5 จุดต้องซิงค์กันเอง — แล้ว drift แล้วจริง
- **Severity:** สูง (กระทบความถูกต้องของ KPI ข้ามโมดูลใน Executive/KAI) แต่ยังไม่พังทันทีกับ data ชุดปัจจุบัน → P1

## 3. Root cause

- source workbooks ใช้ convention ต่างกัน (Sales/Booking ใช้ "04-EX"/"03-TP", Stock ใช้ "03-EX"/"04-TP") และ app เลือก map ต่อโมดูลแทนที่จะ normalize ตอนนำเข้า
- ไม่มี "single source of truth" สำหรับ product taxonomy และไม่มี import-time validation

## 4. Fix Proposal

1. **สร้าง canonical product module เดียว** — `lib/dashboard/product-codes.ts` (หรือตาราง `product_codes` ใน D1):
   - `CANONICAL_PRODUCT_CODES: Record<Module, Record<Group, string[]>>` — รวม 4 ตารางปัจจุบันไว้ที่เดียว พร้อม `source` annotation
   - ฟังก์ชันเดียว `classifyProduct(row, module)` → `TT|CH|EX|TP|MAX|IM|IMO|OT|Unknown` ใช้ร่วมกันทั้ง Sales/Booking/Stock/KAI/Booking-page
   - `productCategory()` ถูกแทนที่ด้วย classify ตัวเดียวกัน (เลิก substring)
   - KAI `PRODUCT_CODES` อ่านจาก module นี้ (ลด 1 แหล่ง drift)

2. **Import-time validation (Data Hub)** — ปิดช่อง "silent Unknown":
   - เพิ่ม product-code validator ใน `lib/data-hub/validate-import.ts` + `source-definitions.ts`: code ที่ไม่รู้จัก → Warning/Failed พร้อมรายงานแถว (มีกลไก failed-row report อยู่แล้ว)
   - เพิ่มรายงาน data-quality: distinct product codes ต่อ module เทียบ canonical — ใช้เป็น early-warning เมื่อ workbook เปลี่ยน convention

3. **Reconcile data แบบ one-off (ไม่ใช่ code)**:
   - ตรวจกับทีมธุรกิจว่า Stock `03-EX`/`04-TP` เป็น convention ที่ถูกต้องของ stock workbook หรือเป็นความคลาดเคลื่อนของแหล่งข้อมูล → ถ้าผิด ให้ backfill แก้ source/import mapping (ไม่แก้ตัวเลขย้อนหลังด้วยมือ)
   - ตัดสินใจชะตากรรมของ `08-TX`/`05-TX`/`MITSU`/`?` อย่างเป็นทางการ (map เป็น OT / เก็บเป็น known-unknown)

4. **Parity test บังคับ** — fixture ที่มีทุก code (01-TT…08-OT, 03-EX, 04-TP, 05-TX, 08-TX, MITSU, plain TT/CH/EX) ต้องได้ canonical group เดียวกันผ่านฟังก์ชันของทั้ง 4 โมดูล

---

# E3 — Target ที่อนุมัติไม่ถูกต่อเข้ากับ UI (P1)

## 1. ปัญหา (Evidence)

**Target มีอยู่ครบและใช้งานได้จริง:**
- ตาราง `business_targets` (schema.ts:352) + migration `drizzle/operations/0006` + repository `findApprovedTarget` (exact-scope, newest-approved-wins)
- Seed ข้อมูล local: `scripts/import-local-targets.mjs` — H1-2026 original + H2-2026 revised (sourceVersion), SALES_UNITS ระดับ company + ราย product group
- **KAI ใช้เต็มรูปแบบ:** `executive-intelligence.ts` (signals TARGET_AHEAD/GAP ผ่าน `getCompanyMonthlyTarget` + product target TT/CH), `runtime-query-v2.ts` `salesTarget()` (TARGET_CURRENT/ACHIEVEMENT/GAP × SALES_UNITS/SALES_REVENUE/GP1), tool `kmm-business.ts` (ตอบเป้า/actual/gap ภาษาไทย), `app/api/daily-management/route.ts` (อ่าน SALES_UNITS)
- KAI มี business rule เพิ่ม: product group target ใช้ `TT`, `CH`, และ **`EX_TP` (EX+TP รวมกัน)** — เห็นใน `kai-phase2b-final-audit.test.mjs:203` + `salesTarget()` ที่ runtime

**แต่ UI หลักไม่ถูกต่อ:**
- `app/api/sales/route.ts:28` → `plan: { year: null, months: [], units: [] }` และ `business.target: getTargetAvailability({}, null)` → `{ available: false, reason: "Target data is not available in Sprint 2.2." }`
- `components/dashboard/dashboard-page.tsx` `createLiveDashboardData()` → `plan: { year: 0, months: [], units: [], revenue: [], expense: [] }` พร้อม comment "Sales targets are not yet supplied by the Dashboard API"
- `lib/sales/business-service.ts:157` `getTargetAvailability` ยังตอบ "Sprint 2.2"
- แต่ `components/sales/sales-page.tsx` ยังมี **code UI target ที่รออยู่แล้ว**: `targetAllowed` + `plan.units[month-1]` (บรรทัด 456-457), `values: plan.units.map(...)` (814), `plan={data.plan}` (1378) → โครงสร้าง legacy "plan" (units/revenue/expense arrays) ถูกป้อนข้อมูลว่าง
- DESIGN.md V3.5 ระบุ: "Target: Sales actual-versus-target uses a bullet chart with an explicit target marker"

## 2. Impact

- ผู้บริหารบน Executive Dashboard และหน้า Sales **มองไม่เห็น achievement เทียบเป้าที่อนุมัติ** — แม้ข้อมูลมีอยู่แล้วใน D1
- DESIGN.md กับ implementation ไม่ตรงกัน (สเปกค้าง)
- ผู้ใช้ที่อยากรู้เป้าต้องถาม KAI → การตัดสินใจถูกบังคับผ่าน chat แทน dashboard
- ความเสี่ยง secondary: ถ้าใครต่อ target ด้วยมือ/ด้วย legacy plan โดยไม่ใช้ `businessTargets` จะเกิด **two sources of truth** (หลุมที่ code ป้องกันไว้แล้วโดยตั้งใจ — comment "Keep this empty rather than borrowing")
- **Severity:** สูง (ฟีเจอร์ที่สเปกไว้ขาดจาก UI หลัก + เสี่ยง data inconsistency ในอนาคต) → P1

## 3. Root cause

- โครงสร้าง `plan` ใน UI เกิดก่อนตาราง `business_targets` (เดิมมาจาก static JSON)
- `business_targets` ถูกเพิ่มเพื่อ KAI โดยเฉพาะ → UI ไม่ถูก rewired
- `getTargetAvailability` เป็น stub เก่าที่ไม่เคยถูกแทนที่

## 4. Fix Proposal

1. **Server: ต่อ target เข้ากับ API หลัก**
   - `/api/sales` และ `/api/operations`: ใช้ `getCompanyMonthlyTarget({ companyId, year, month, metric: "SALES_UNITS" })` (มีอยู่แล้ว) คืนพร้อม `sourceVersion`, `effectiveFrom`, `approvalStatus`
   - Product-group targets (TT, CH, EX_TP ตาม convention KAI) เมื่อ user filter product group
   - ทางเลือก: endpoint แยก `/api/targets` สำหรับช่วง/มิติที่กว้างขึ้น — แต่เริ่มจากฝังใน response ที่มีอยู่จะเร็วกว่าและใช้ filter เดียวกัน

2. **Dashboard: ต่อ bullet chart (ตาม DESIGN.md)**
   - ใช้ `targetProgress(actual, target)` (มีอยู่แล้วใน targets/business-service) → achievement %
   - **เคารพ full-month rule เดียวกับ KAI:** ใช้ `canEvaluateFullPeriodTarget(period, asOf)` → ถ้ายังไม่เต็มเดือน แสดง "Target: แสดงเมื่อครบเดือน" แทนตัวเลข (กันตัวเลขหลอก)
   - แสดง `sourceVersion` ใน tooltip (transparency ของ data governance)

3. **Sales page: เปิดใช้งาน plan chart ที่มีอยู่**
   - แทนที่ `data.plan` ว่างด้วย target จริงจาก API; เอา stub `getTargetAvailability` ออก (หรือเปลี่ยนให้อ่านจาก D1 จริง)
   - คง UI เดิม (bullet/plan) ที่เขียนไว้แล้ว — เป็นการ "เสียบปลั๊ก" ไม่ใช่เขียนใหม่

4. **Single source ของ "target ใช้ได้เมื่อไหร่"**
   - ย้าย `canEvaluateFullPeriodTarget` + `isTargetDependentExecutiveSignal` ไปใช้ร่วมกันระหว่าง KAI และ UI (ตอนนี้ rule อยู่ใน `lib/kai/executive-intelligence.ts`) → UI กับ KAI ตอบตรงกันเสมอ

5. **Data: seed staging/prod อย่างเป็นทางการ**
   - ปัจจุบัน target seed เป็น local-only (`import-local-targets.mjs`) → ทำเป็น migration ที่ review แล้ว (เช่น `drizzle/operations/0041_*`) พร้อม policy sourceVersion (H1-2026 original vs H2-2026 revised; `effectiveFrom` precedence ถูกจัดการใน repository แล้ว)
   - นี่ผูกกับ A1/F1 (ต้อง reconcile migration ก่อน) — วางงานต่อกัน

6. **Tests**
   - Contract: `/api/sales` คืน target + sourceVersion เมื่อมี approved row; คืน `available:false` เมื่อไม่มี
   - Eligibility: เดือนเต็มเท่านั้นที่ได้ achievement (test ร่วมกับ KAI rule เดียวกัน)
   - Regression: targets-regression.test.mjs ขยายครอบ UI payload

---

# สรุปลำดับการทำ (dependency)

1. **E1** — แก้ได้อิสระทันที (selector + callers + tests) · ไม่มี dependency
2. **E2** — เริ่มจาก canonical module + import validation (ไม่ต้องแตะ data) แล้วค่อย reconcile data กับทีมธุรกิจ
3. **E3** — ต่อยอดจาก E2 (ใช้ product-group เดียวกัน), ต้องเคลียร์ A1/F1 (migration/seed) ก่อน rollout prod; ส่วน staging ทำได้ทันที

**ข้อเสนอ cross-cutting:** ทั้ง 3 เรื่องมีรูปแบบเดียวกัน — "rule กระจัดกระจายอยู่หลายที่โดยไม่มี single source of truth" (asOf, product taxonomy, target eligibility) → ควรสร้าง layer `lib/business-rules/` ที่รวมนิยามทางการ (product codes, threshold, target validity, as-of) และให้ทุกโมดูล + KAI + Data Hub import จากที่เดียว
