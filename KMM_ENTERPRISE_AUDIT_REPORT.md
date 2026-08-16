# KMM Enterprise Audit Report

**Full System Audit — Long-term development planning**

- **Audit date:** 2026-08-15 (Asia/Bangkok) · **Branch:** `feature/kai-phase1e-knowledge-layer`
- **Mode:** Repository + local environment only · **ห้ามแก้ไข code / commit / deploy / เปลี่ยน database** — Audit เท่านั้น (ปฏิบัติตามแล้ว)
- **Verification run:** `tsc --noEmit` ✅ 0 errors · `npm run lint` ✅ 0 errors / 73 warnings · 50 regression test files
- **ข้อจำกัด:** ไม่ได้รันแอปจริง — Mobile UX เป็น static review (ต้อง device UAT ยืนยัน), Performance เป็นการประเมิน static (ไม่มี load env), Security เป็น static review (ไม่ใช่ pen-test)

---

## Executive Summary

### Scorecard ตามพื้นที่ (1-5)

| # | พื้นที่ | คะแนน | สถานะหลัก |
|---|---|---|---|
| 1 | Architecture | 3.5 | แข็งแรง (auth/company context) แต่ migration topology เสี่ยง |
| 2 | Frontend React | 3.0 | โครงสร้างดี แต่ page ใหญ่ + directory คู่ขนาน |
| 3 | Backend API | 3.5 | มี security pattern ดี, ยัง full-table load |
| 4 | Cloudflare Worker | 3.5 | PMTiles/range ถูกต้อง, ขาด security headers |
| 5 | D1 Schema | 3.0 | design ดี, ขาด index/FK/TEXT money |
| 6 | Migration Strategy | 2.5 | **3 lineage + prod divergence — ต้อง reconcile** |
| 7 | Data Quality | 3.0 | validation ดี, product codes + junk data เสี่ยง |
| 8 | Business Logic | 3.5 | evidence-first ดี, rules กระจัดกระจาย |
| 9 | KPI Calculation | 3.0 | **มี P0 (booking age) + P1 (classification/target)** |
| 10 | Security | 3.5 | auth แข็งแรง, ขาด headers/rate-limit ข้าม isolate |
| 11 | Permission | 3.5 | central gate ดี, RBAC หยาบ |
| 12 | Performance | 3.0 | full-table load + ไม่มี index บางตาราง |
| 13 | Mobile UX | 3.0 | design รองรับดี, ยังไม่ผ่าน 375px UAT gate |
| 14 | Design System | 3.5 | token ครบ, ยังมี doc drift + hardcode |
| 15 | Localization | 3.0 | **my.ts เหลือ 55% ของ keys** |
| 16 | KAI Readiness | 4.0 | จุดแข็งที่สุดของระบบ (evidence-first, fail-closed) |
| 17 | Agriculture | 3.5 | schema/provenance ดีมาก, ยัง local-only + weather model จำกัด |
| 18 | Future Scalability | 3.0 | ต้องวาง aggregation + migration baseline |

### Top Priorities (P0–P1)

| Priority | Finding | Area | Severity |
|---|---|---|---|
| **P0** | Booking age แช่แข็งที่ 2026-07-11 (hardcode) | KPI | สูง |
| **P1** | Product-type classification ไม่สอดคล้องข้ามโมดูล + ไม่มี validation | KPI/Data | สูง |
| **P1** | Approved targets ไม่ถูกต่อเข้ากับ Dashboard/Sales UI | KPI | สูง |
| **P1** | Migration topology: 3 lineage + prod divergence | Migration/Arch | สูง |
| **P1** | `booking_transactions`/`stock_transactions` ไม่มี index | D1 | กลาง |
| **P1** | Myanmar localization เหลือ 216/394 keys (55%) | Localization | กลาง |

---

# ส่วนที่ 1: Findings รายพื้นที่

---

## 1. Architecture

### ARCH-1 · Migration topology: 3 lineage + prod divergence — กลาง → **P1**
- **Issue:** มี 3 migration lineage อิสระ: `drizzle/` (0000–0011, ผูกกับ COMPANY_DB แต่สร้าง ops tables ด้วย เช่น `sales_transactions`, `0008_sales_invoice_lookup`), `drizzle/operations/` (0000–0040), `drizzle/production-commission/` (prod-only, migration ของตัวเองแยก `commission_prod_migrations` และ "deliberately does not mark or execute migrations 0007–0023")
- **Evidence:** `wrangler.json`, `wrangler.staging.jsonc`, `wrangler.production-commission.jsonc`, `drizzle/production-commission/0001_commission_prod_001.sql`, `drizzle/0000_swift_stryfe.sql`, `docs/KMM_WEATHER_AGRICULTURE_PHASE1_BASELINE.md`
- **Business Impact:** ไม่สามารถการันตีว่า prod/staging/local มี schema ตรงกัน — KAI knowledge tables (0007–0020) และ agriculture (0024–0040) อาจไม่อยู่ใน prod; COMPANY_DB อาจมี ops tables ค้าง (stale)
- **Recommended Solution:** จัดทำ authoritative migration map ต่อ environment (`wrangler d1 migrations list`), re-baseline lineage COMPANY_DB (ลบ ops tables), ประกาศ rollout plan สำหรับ KAI knowledge + agriculture สู่ prod
- **Priority:** P1

### ARCH-2 · Prod vs staging parity — กลาง → **P2**
- **Issue:** prod `wrangler.json` ไม่มี `MULTI_COMPANY_ENABLED` (single-company) และไม่มี `migrations_dir`; staging มีทั้งสอง + KM (Kubota Maesod, TH) เฉพาะ staging
- **Evidence:** `wrangler.json` vs `wrangler.staging.jsonc`
- **Business Impact:** ฟีเจอร์ที่ test ผ่าน staging (multi-company, KM) อาจทำงานต่างบน prod; prod migrations run แบบ out-of-band ไม่มี config กำกับ
- **Recommended Solution:** ประกาศ vars + `migrations_dir` ให้ครบทุก environment พร้อม procedure; ระบุ multi-company flag แบบชัดเจน
- **Priority:** P2

### ARCH-3 · Business rules hardcode ใน code — กลาง → **P2**
- **Issue:** `capabilitiesForCompany()` hardcode Marketing/Expense เป็น KMM-only; `enrichAuthorizedCompanies()` fallback currency/TZ จาก `company.code === "KM"` — ข้อมูลนี้มีใน DB อยู่แล้ว (`company_currencies`, `company_localizations`)
- **Evidence:** `lib/company-context/types.ts`, `lib/server/company-context.ts`
- **Business Impact:** เพิ่มบริษัทใหม่ต้องแก้โค้ด; ข้อมูลที่แสดงอาจไม่ตรงกับ setting ที่ admin ตั้งไว้
- **Recommended Solution:** ขับ capability/default จาก data; เหลือ hardcode เป็น fallback + comment
- **Priority:** P2

### ARCH-4 · Client company context เป็น module singleton — ต่ำ-กลาง → **P2**
- **Issue:** `lib/company-context/client-store.ts` เก็บ `activeCompany` ใน module-level mutable state
- **Evidence:** `lib/company-context/client-store.ts`
- **Business Impact:** ถ้าถูก import ใน RSC/SSR จะเกิด request bleed (บริษัทผิด)
- **Recommended Solution:** จำกัด client-only + document, หรือ migrate เป็น React context
- **Priority:** P2

### ARCH-5 · จุดแข็ง (verified)
- JWT verification แบบ hand-rolled ครบถ้วน (RS256, aud/iss/exp/iat, JWKS cache) — `lib/server/firebase-auth.ts`
- `requireCompanyContext()` เป็น central gate (token → membership → role → company scope) ทุก API route
- Worker PMTiles range request ถูกต้อง (byte-range, 416) + basemap proxy retry 1 ครั้ง

---

## 2. Frontend React Structure

### FR-1 · Page components ขนาดใหญ่เกินไป — กลาง → **P2**
- **Issue:** `marketing-intelligence-page.tsx` 4,001 บรรทัด, `dashboard-page.tsx` 1,607, `sales-page.tsx` 1,461, `stock` 1,010, maps ~1,100–1,200 — ผสม data prep, state, presentation
- **Evidence:** wc -l ของไฟล์; สอดคล้องกับ V2 design audit
- **Business Impact:** แก้ไขช้า/เสี่ยง regression; onboarding ยาก; test ต้องพึ่ง structural strings
- **Recommended Solution:** แยก data-prep (selectors มีแล้ว) + presentational components; ตั้งเป้า page shell < 800 บรรทัด
- **Priority:** P2

### FR-2 · Directory conventions คู่ขนาน — กลาง → **P2**
- **Issue:** `app/` + `components/` + `lib/` อยู่คู่กับ `src/modules/`, `src/context/`, `src/hooks/`, `src/locales/` (งานใหม่ weather/agriculture อยู่ใน `src/modules`)
- **Evidence:** โครงสร้าง root, `app/layout.tsx` import จาก `../src/context/LocaleContext`
- **Business Impact:** สับสนในการค้นหา/วางงานใหม่; เกิดไฟล์ซ้ำแนวคิด
- **Recommended Solution:** กำหนด feature-slice เป้าหมายและ migrate อย่างค่อยเป็นค่อยไป
- **Priority:** P2

### FR-3 · Dead / half-wired code — ต่ำ → **P2**
- **Issue:** `LegacyLineChart` + `void LegacyLineChart;` ใน dashboard-page; unused imports `getAgedStock`/`getAverageStockAge`/`getStockValue` ใน stock page; `_onActiveMetricChange` ถูก void ใน maplibre map; `marketing: []` ใน dashboard data
- **Evidence:** `components/dashboard/dashboard-page.tsx`, `components/stock/stock-intelligence-page.tsx`, `components/marketing/myanmar-marketing-map-maplibre.tsx`
- **Business Impact:** maintenance noise; "Recent Activity" บน dashboard ไม่มี data source จริง
- **Recommended Solution:** ลบ dead code; ตรวจว่า Recent Activity ควรมี live source หรือถอด surface
- **Priority:** P2

---

## 3. Backend API

### API-1 · Endpoint โหลดทั้งตารางต่อ request — กลาง → **P2**
- **Issue:** `/api/sales`, `/api/operations`, `buildExecutiveSnapshot()` โหลดทุกแถวของบริษัท (sales/booking/stock) แล้ว aggregate ใน memory — ไม่มี pagination/server-side aggregation
- **Evidence:** `lib/sales/repository.ts` (`listSalesTransactions` ไม่มี filter ปี), `lib/operations/repository.ts`, `lib/kai/executive-intelligence.ts:83-90`
- **Business Impact:** payload + latency โตตามข้อมูล; 3,474 แถวตอนนี้ OK แต่ปีต่อปีหนักขึ้น; KAI เรียก 3 ตารางเต็มทุกคำถาม
- **Recommended Solution:** server-side aggregation + period filter ที่ DB level; เริ่มจาก KAI/executive ก่อน
- **Priority:** P2

### API-2 · จุดแข็ง (verified)
- ทุก route ใช้ `requireCompanyContext` + permission + error mapping (401/403/500) ถูกต้อง
- Agriculture POST/PATCH: enum whitelist, length limit, regex ID, company scope — แข็งแรง
- KAI: body/history bounds, rate limit 12/min/user, timeout 30s, fallback model
- Cache-Control ถูกต้อง (`no-store` สำหรับ data, `private, max-age=60` สำหรับ weather)

---

## 4. Cloudflare Worker

### WK-1 · ไม่มี security headers — ต่ำ-กลาง → **P2**
- **Issue:** ไม่มี CSP / HSTS / X-Frame-Options / Referrer-Policy ใดๆ (มีแค่ `X-Content-Type-Options: nosniff` บน route daily-management template)
- **Evidence:** grep headers ทั้ง repo → `app/api/daily-management/template/route.ts:12` เท่านั้น
- **Business Impact:** เสี่ยง clickjacking/phishing แบบ basic บน internal dashboard; ข้อมูลไม่รั่วโดยตรง แต่ขาด defense-in-depth
- **Recommended Solution:** เพิ่ม security headers ใน worker (X-Frame-Options, HSTS, Referrer-Policy, nosniff); ประเมิน CSP ทีหลัง (ซับซ้อนเพราะ MapLibre blob + inline styles)
- **Priority:** P2

### WK-2 · Legacy fallback payload ถูก ship เป็น static asset — กลาง → **P2**
- **Issue:** `public/dashboard-data.json` (1.8MB), `kmm-real-data.json`, `data-import-report.json` ถูก serve ให้ client ทุกคน — fallback ถูก env-gate แต่ payload ยัง ship
- **Evidence:** `public/` (du -sh), `lib/operations/client.ts` (env gate)
- **Business Impact:** bandwidth เสีย + ข้อมูลตัวอย่างธุรกิจถูก expose เป็น static file (ถ้า push ขึ้น prod)
- **Recommended Solution:** ย้ายออกจาก `public/` หรือ exclude จาก prod asset build เมื่อ D1 เป็น path หลัก
- **Priority:** P2

### WK-3 · KAI rate limit เป็น in-memory per isolate — ต่ำ → **P2**
- **Issue:** `requestWindows` เป็น Map ใน module — ไม่ share ข้าม isolate/edge
- **Evidence:** `app/api/kai/chat/route.ts` (RATE_LIMIT_REQUESTS=12, Map)
- **Business Impact:** ผู้ใช้เลี่ยง rate limit ได้ด้วยการยิงหลาย isolate; ค่าใช้จ่าย AI สูงเกินควบคุม
- **Recommended Solution:** rate limit แบบ distributed (D1 counter หรือ Cloudflare) เมื่อ KAI ใช้งานจริงจัง
- **Priority:** P2

---

## 5. D1 Database Schema

### DB-1 · `booking_transactions` / `stock_transactions` ไม่มี index — กลาง → **P1**
- **Issue:** ตาราง booking/stock ไม่มี index เลย; sales มี index เดียว `(company, importYear, importMonth, invoiceNo)` — ทุก query filter company/year/month/branch
- **Evidence:** `db/schema.ts` (booking:399, stock:431)
- **Business Impact:** ข้อมูลโตขึ้น → scan ทั้งตารางทุก query → latency dashboard/KAI เพิ่ม
- **Recommended Solution:** เพิ่ม compound index `(companyId, importYear, importMonth)` + `(companyId, branch)` สำหรับ booking/stock (additive, ปลอดภัย)
- **Priority:** P1

### DB-2 · เงินเก็บเป็น TEXT — กลาง → **P2**
- **Issue:** `sale_amount`, `gp1`, `final_received`, `commission`, `target_value`, `booking_price`, `msrp` เป็น TEXT — ไม่มี numeric integrity; adapter จัดการ comma แต่ format แปลกๆ cast ผิดเงียบๆ ได้
- **Evidence:** `db/schema.ts` หลายตาราง; `lib/operations/adapters.ts` (`numberOrNull`)
- **Business Impact:** ตัวเลข dashboard ผิดได้โดยไม่มี error; audit ยาก
- **Recommended Solution:** normalize ตอน ingestion; พิจารณา INTEGER minor-units สำหรับตารางใหม่
- **Priority:** P2

### DB-3 · ไม่มี FK / CHECK constraints — กลาง → **P2**
- **Issue:** ไม่มี `.references()` เลย; status/product_type/approval_status เป็น TEXT อิสระ
- **Evidence:** `db/schema.ts` ทั้งไฟล์
- **Business Impact:** referential integrity อยู่ที่ app layer ล้วน — พลาดจุดเดียวได้ orphan data
- **Recommended Solution:** เพิ่ม CHECK/enum validation ใน import validator (มีแล้วบางส่วน) + เอกสาร FK boundary
- **Priority:** P2

### DB-4 · Legacy duplicate columns — กลาง → **P2**
- **Issue:** booking: `booking_no`/`booking_number`, `branch`/`branch_code`/`branch_name`, `status`/`booking_status`/`purchase_status`; stock: `as_of_date`/`stock_date`/`snapshot_date`, `product`/`product_type`/`product_group` — adapter เลือกค่า แต่สองคอลัมน์ drift ได้
- **Evidence:** `db/schema.ts` booking:399, stock:431; `lib/operations/adapters.ts`
- **Business Impact:** ข้อมูลเดียวกันแสดงต่างกันตาม path ที่เลือก; data quality audit ยาก
- **Recommended Solution:** data-quality job ตรวจคู่คอลัมน์ที่ขัดแย้ง; วางแผน canonicalization
- **Priority:** P2

### DB-5 · จุดแข็ง (verified)
- `business_targets`: empty-string dimension keys, exact-version unique, effectiveFrom — design ดีมาก
- Agriculture schema: provenance ครบ (source, confidence, verification, valid_from/to, data gaps)
- ทุกตารางมี created_by/updated_by; มี audit_logs

---

## 6. Migration Strategy

### MG-1 · สาม lineage + prod divergence — สูง → **P1**
- **Issue:** (รายละเอียด ARCH-1) — prod-commission lineage ไม่ mark ops 0007–0023; agri 0024–0040 เป็น local-only โดย design
- **Evidence:** `drizzle/`, `drizzle/operations/`, `drizzle/production-commission/`, docs weather/agri
- **Business Impact:** production อาจขาด KAI knowledge + agri tables → ฟีเจอร์ KAI/weather บน prod ทำงานไม่ครบ หรือ error
- **Recommended Solution:** reconcile จริง (ดู ARCH-1) + schema-drift check ใน release pipeline
- **Priority:** P1

### MG-2 · Target seed เป็น local-only — กลาง → **P2**
- **Issue:** `businessTargets` seed ผ่าน `scripts/import-local-targets.mjs` (H1/H2-2026) — ไม่เป็น migration ที่ review สำหรับ staging/prod
- **Evidence:** `scripts/import-local-targets.mjs`, `drizzle/operations/0006` (create เท่านั้น)
- **Business Impact:** target UI (เมื่อต่อ E3) จะว่างบน staging/prod
- **Recommended Solution:** ทำ seed migration ที่ review แล้ว (ผูก E3)
- **Priority:** P2

### MG-3 · drizzle.config เดียวสำหรับสอง DB — ต่ำ → **P2**
- **Issue:** `drizzle.config.ts` ชี้ schema เดียวไป `./drizzle` — ops migrations (0000–0040) ถูก maintain แบบ manual/named ไม่ผ่าน drizzle-kit มาตรฐาน
- **Evidence:** `drizzle.config.ts`, ชื่อไฟล์ใน `drizzle/operations/`
- **Business Impact:** risk ของ human error ใน migration; snapshot ไม่อัปเดตสำหรับ ops chain
- **Recommended Solution:** แยก config ต่อ DB หรือจัดทำ generator/validation ของ ops chain
- **Priority:** P2

---

## 7. Data Quality

### DQ-1 · Product-type codes ไม่สอดคล้องข้ามโมดูล + ไม่มี validation — สูง → **P1**
- **Issue:** Sales ใช้ `04-EX`/`03-TP`, Stock ใช้ `03-EX`/`04-TP` (สลับ!), Booking ใช้ code เปล่า — มี 4 ตาราง mapping คู่ขนาน + substring function; code ใหม่/แปลกปลอม classify เป็น Unknown **เงียบๆ**
- **Evidence:** `lib/dashboard/booking-selectors.ts:27`, `lib/dashboard/stock-selectors.ts:26`, `lib/sales/business-service.ts:15`, `lib/kai/runtime-query-v2.ts:100`, `lib/dashboard/product-groups.ts:13`, ข้อมูลจริงใน `public/dashboard-data.json`
- **Business Impact:** KPI รายสินค้าข้ามโมดูล (stock-vs-booking gap, KAI product breakdown) ผิดได้; workbook เปลี่ยน convention → ตัวเลขหายเงียบๆ
- **Recommended Solution:** design ครบแล้วใน `docs/KMM_PRODUCT_TAXONOMY_DESIGN.md` (canonical module + Data Hub validation + parity test)
- **Priority:** P1

### DQ-2 · Junk codes ในข้อมูลจริง — กลาง → **P2**
- **Issue:** `?` (159 แถว sales), `05-TX` (4), `MITSU` (1), `08-TX` (3 stock) — แต่ละ surface จัดการต่างกัน (Other/Unknown/KAI fail-closed)
- **Evidence:** `public/dashboard-data.json`, `public/data-import-report.json`, `lib/kai/runtime-query-v2.ts:106`
- **Business Impact:** ผู้ใช้เห็นหมวด "Other"/"Unknown" ต่างกัน; ไม่รู้ว่าข้อมูลเสียหรือตั้งใจ
- **Recommended Solution:** ระบุชะตากรรมแต่ละ code กับทีมธุรกิจ + จับที่ import (ดู taxonomy design)
- **Priority:** P2

### DQ-3 · Freshness metadata บางส่วน — กลาง → **P2**
- **Issue:** มี `fetchedAt`/cache age (weather) + `sourceUpdatedAt` (sales) แต่ booking/stock/agri ไม่มี per-source run/valid timestamps
- **Evidence:** `docs/KMM_WEATHER_AGRICULTURE_PHASE1_BASELINE.md`, `lib/operations/client.ts`
- **Business Impact:** ไม่รู้ว่าข้อมูล booking/stock ล้าสมัยแค่ไหน — attention panel แสดง "freshness" ไม่ครบทุกแหล่ง
- **Recommended Solution:** ขยาย `dataImportHistory` ด้วย validity window + แสดง freshness รายแหล่ง
- **Priority:** P2

---

## 8. Business Logic

### BL-1 · Business rules กระจัดกระจายใน code — กลาง → **P2**
- **Issue:** KMM-only capabilities, KM currency/TZ fallback, KMM Free Stock ownership rule, `isHotBooking` (purchaseStatus A/B/C HOT), EX_TP combined target group — อยู่กระจัดกระจายหลายไฟล์ ไม่มี data dictionary
- **Evidence:** `lib/company-context/types.ts`, `lib/dashboard/booking-selectors.ts:49`, `lib/dashboard/stock-selectors.ts:82`, KAI tests (`kai-phase2b-final-audit.test.mjs:203`)
- **Business Impact:** เปลี่ยน rule ต้องไล่แก้หลายจุด; พลาดจุดเดียว = ตัวเลขไม่ตรงกัน
- **Recommended Solution:** สร้าง `lib/business-rules/` รวมนิยามทางการ (ผูกกับ taxonomy design)
- **Priority:** P2

### BL-2 · All-or-nothing metric sums — ต่ำ → **P2**
- **Issue:** `completeMetricSum` คืน null ถ้าทุกแถวมีค่าไม่ครบ — แถวเดียวขาด gp1 = Gross Profit ว่างทั้ง scope
- **Evidence:** `lib/sales/business-service.ts:64`
- **Business Impact:** KPI ว่างทั้งที่ข้อมูล 99% พร้อม — ผู้บริหารตีความ "ไม่มีข้อมูล" ผิด
- **Recommended Solution:** แสดง coverage ("GP available 94%") ควบคู่
- **Priority:** P2

---

## 9. KPI Calculation

### KPI-1 · Booking age แช่แข็งที่ 2026-07-11 (hardcode) — สูง → **P0**
- **Issue:** `bookingAge()` default `asOf = new Date("2026-07-11")` — วันนี้ (15 ส.ค.) อายุ booking ต่ำกว่าจริง ~35 วัน; KPI อายุเฉลี่ย, health bucket, management follow-up (>90 วัน), heatmap, export CSV ผิดทั้งหมด
- **Evidence:** `lib/dashboard/booking-selectors.ts:72-73`, `components/booking/booking-intelligence-page.tsx:162`, `lib/operations/business-service.ts:15` (hardcode จุดเดียวใน repo — scan ยืนยัน)
- **Business Impact:** รายการ booking ที่ควร escalate หาย; ข้อมูลส่งออกผิด — กระทบการตัดสินใจวันนี้
- **Recommended Solution:** `asOf` เป็น required param, server คำนวณตาม company TZ (proposal ละเอียดใน `reports/static-audit-phase1-deepdive-p0p1.md` §E1)
- **Priority:** P0

### KPI-2 · Product classification ไม่ตรงกัน (ซ้ำ DQ-1) — สูง → **P1**
- **Issue/Impact/Recommended:** ตาม DQ-1 — KPI รายสินค้าข้ามโมดูลไม่รับประกันความสอดคล้อง
- **Priority:** P1

### KPI-3 · Targets ไม่ถูกต่อเข้ากับ Dashboard/Sales UI — สูง → **P1**
- **Issue:** `businessTargets` + repository + KAI ใช้ครบ แต่ `/api/sales` ส่ง `plan` ว่าง + `getTargetAvailability` ตอบ "Sprint 2.2"; dashboard ส่ง plan ว่าง; DESIGN.md V3.5 ระบุ bullet chart พร้อม target marker
- **Evidence:** `app/api/sales/route.ts:28,39`, `components/dashboard/dashboard-page.tsx` (createLiveDashboardData), `lib/sales/business-service.ts:157`, `components/sales/sales-page.tsx:456,1378`
- **Business Impact:** ผู้บริหารมองไม่เห็น achievement เทียบเป้าบน UI หลัก — ต้องถาม KAI; สเปกค้าง; เสี่ยง two sources of truth
- **Recommended Solution:** ต่อ `getCompanyMonthlyTarget` + `targetProgress` เข้า API/UI โดยเคารพ full-month rule (`canEvaluateFullPeriodTarget`) ร่วมกับ KAI (proposal ใน deep-dive §E3)
- **Priority:** P1

### KPI-4 · Stock filter ใช้ import period ไม่ใช่ snapshot date — กลาง → **P2**
- **Issue:** stock `year`/`month` มาจาก `importYear`/`importMonth`; แถวที่ year ว่างผ่าน filter
- **Evidence:** `lib/operations/business-service.ts:26`, `lib/operations/adapters.ts`
- **Business Impact:** filter ปีอาจกรองผิดงวดสำหรับ point-in-time snapshot
- **Recommended Solution:** normalize เป็น as-of date + require year
- **Priority:** P2

### KPI-5 · Aging หลาย representation — ต่ำ → **P2**
- **Issue:** `ageDays` (ตัวเลข) vs `ageBucket` (string) vs `stockAgeBand`/`stockHealthTone` (regex parse) — เสี่ยงต่างกัน
- **Evidence:** `lib/dashboard/stock-selectors.ts`, `components/dashboard/dashboard-page.tsx`
- **Recommended Solution:** คำนวณจากตัวเลขเดียว; bucket เป็น display เท่านั้น
- **Priority:** P2

### KPI-6 · จุดแข็ง (verified)
- YoY เฉพาะปีเดียว, N/A honesty, KAI thresholds รวมศูนย์, target เฉพาะเดือนเต็ม, Fact Lock

---

## 10. Security

### SEC-1 · ขาด security headers (ซ้ำ WK-1) — กลาง → **P2**
- **Recommended:** เพิ่ม X-Frame-Options/HSTS/Referrer-Policy/nosniff; ประเมิน CSP

### SEC-2 · Legacy data static files expose — กลาง → **P2**
- **Issue:** `dashboard-data.json` (ข้อมูลตัวอย่างธุรกิจ) serve เป็น static public file
- **Recommended:** ย้าย/ตัดออกจาก prod asset (ซ้ำ WK-2)

### SEC-3 · จุดแข็ง (verified)
- JWT verification ครบถ้วน; central company gate; KAI security request interception (ก่อน tool routing); input bounds ทุกจุด; ไม่มี raw rows ถึง LLM; ไม่มี secret ใน repo (env อยู่ใน .gitignore)

---

## 11. Permission

### PER-1 · RBAC หยาบ — กลาง → **P2**
- **Issue:** 4 บทบาท × 5 permissions (view/edit/publish/disable/restore) — ไม่มี module-level/field-level granularity; viewer เห็นทุกโมดูลของบริษัทที่เข้าถึงได้
- **Evidence:** `lib/company-management/permissions.ts`, `lib/company-context/types.ts`
- **Business Impact:** ต้องการจำกัด (เช่น salesperson เห็นเฉพาะทีมตัวเอง) ต้องเขียน logic เองทุกจุด; data hub import กับ view แยกกันไม่ออกตามโมดูล
- **Recommended Solution:** module×role matrix เมื่อ surface ใหม่ (Data Hub write, settings) ขยาย
- **Priority:** P2

### PER-2 · Capability flags hardcode — ต่ำ → **P2**
- **Issue:** marketing/expense KMM-only hardcode (ซ้ำ ARCH-3)
- **Priority:** P2

---

## 12. Performance

### PERF-1 · Full-table load ต่อ request — กลาง → **P2**
- **Issue/Impact/Recommended:** (ซ้ำ API-1) — วาง server-side aggregation
- **Priority:** P2

### PERF-2 · Booking/stock ไม่มี index (ซ้ำ DB-1) — กลาง → **P1**

### PERF-3 · Static payload 1.8MB ship (ซ้ำ WK-2) — กลาง → **P2**

### PERF-4 · Bundle/map assets ใหญ่ (ความเสี่ยง) — กลาง → **P2**
- **Issue:** marketing page 4,001 บรรทัด + maplibre + 17MB map assets ใน `public/maps` (PMTiles ถูก run_worker_first — ดี)
- **Evidence:** `du -sh public/maps`, ขนาดไฟล์ components
- **Business Impact:** first load บน mobile/ช้า network กระทบ UX; ยังไม่ได้วัดจริง (ไม่มี build env)
- **Recommended Solution:** code-split marketing/map; วัด bundle ในการวาง performance baseline
- **Priority:** P2

---

## 13. Mobile UX

### MOB-1 · 375px UAT gate ยังไม่ผ่าน — กลาง → **P2**
- **Issue:** DESIGN.md ระบุ cross-role + 375px mobile UAT เป็น rollout approval gate — ยัง pending ใน `docs/multi-company/pending-approval.md`; static review ไม่สามารถยืนยันได้
- **Business Impact:** rollout ใหม่ที่ touch layout มือถือเสี่ยง regression ที่ไม่ถูกจับ
- **Recommended Solution:** จัด device matrix UAT (375/390/768) + ก่อนทุก release ใหม่ ใช้ checklist ใน skill `kmm-mobile-ux-audit`
- **Priority:** P2

### MOB-2 · Tables ใช้ fixed min-width + nested overflow — กลาง → **P2**
- **Issue:** booking table `min-w-[1420px]` + `max-h-[480px]` scroll region; V2 audit ระบุ overflow regression เป็น risk area
- **Evidence:** `components/booking/booking-intelligence-page.tsx`, `docs/KMM_DESIGN_SYSTEM_V2_AUDIT.md`
- **Business Impact:** มือถือต้อง scroll แนวนอนหลายชั้น — ข้อมูลสำคัญ (booking aging) หายจาก view
- **Recommended Solution:** ยืนยัน linear summary list บนมือถือทุกตารางหลัก (dashboard มีแล้ว)
- **Priority:** P2

### MOB-3 · จุดแข็ง (verified)
- Design tokens รองรับมือถือ (drawer 280px, bottom sheet, 44px targets, responsive grids, reduced-motion), map มี sheet version, township panel มี mobile variant

---

## 14. Design System

### DS-1 · Token vs DESIGN.md drift (สองส้ม) — กลาง → **P2**
- **Issue:** DESIGN.md ระบุ `--brand-500: #f56600` แต่โค้ดใช้ `#ff7a00`; canvas `#f6f6f3` vs `#f7f8fa`; ยังมี `rgb(245 102 0)` (=#f56600) hardcode ใน `.kmm-map-tool-button.is-active`, `.kmm-intelligence-action`
- **Evidence:** `app/globals.css:67-75`, `DESIGN.md`
- **Business Impact:** brand color ไม่ consistent — asset ภายนอกอ้างอิงผิดสี
- **Recommended Solution:** เลือกสีเดียว + แก้ DESIGN.md/GOLDEN_REFERENCE + ไล่ hardcode
- **Priority:** P2

### DS-2 · Hardcode hex ยังเพียบ — กลาง → **P2**
- **Issue:** township detail CSS, presentation dock, map overlays, TSX utilities (`text-[#4B5563]` ฯลฯ) — token coverage ไม่ครบ
- **Evidence:** `app/globals.css`, `components/dashboard/dashboard-page.tsx`
- **Business Impact:** ธีม/contrast แก้ไม่ได้รวมศูนย์; dark mode อนาคตยาก
- **Recommended Solution:** ขยาย semantic tokens ตามแผน Stage 2/3 ของ V2
- **Priority:** P2

### DS-3 · Localization inconsistency ใน UI (ซ้ำ L2)

---

## 15. Localization TH/EN/MM

### L10N-1 · Myanmar dictionary ไม่ครบ (216/394 keys) — กลาง → **P1**
- **Issue:** `my.ts` มี 216 keys เทียบ `en.ts`/`th.ts` 394 — ประมาณ 45% ของ strings บน locale พม่า fallback เป็นภาษาอังกฤษเงียบๆ (translate() มี fallback)
- **Evidence:** `src/locales/*.ts` (wc -l), `src/locales/index.ts:15`
- **Business Impact:** ผู้ใช้พม่ามอง UI ภาษาแทรกสองภาษา; ความเชื่อมั่นต่ำ; บางคำศัพท์ธุรกิจแปลผิดความหมายได้
- **Recommended Solution:** เติม my.ts ให้ครบตาม key เดียวกับ en (งานแปลต้องให้ทีม/localization review); เพิ่ม lint ตรวจ key parity ระหว่าง locale
- **Priority:** P1

### L10N-2 · Hardcoded strings ข้ามระบบ t() — กลาง → **P2**
- **Issue:** `"รอข้อมูล"`, `"มีข้อมูล"` ใน map panel; KAI recommendations ปนไทย (`executiveRecommendations`) กับอังกฤษ (`recommendationsFor`); format ตัวเลขบางจุด hardcode en-US
- **Evidence:** `components/marketing/myanmar-marketing-map.tsx`, `lib/kai/executive-intelligence.ts`
- **Business Impact:** ภาษาไม่สม่ำเสมอ; แปลไม่ได้ผ่าน locale dict
- **Recommended Solution:** ไล่ทุก string ผ่าน t() + เพิ่ม lint rule
- **Priority:** P2

---

## 16. KAI Readiness

### KAI-1 · จุดแข็ง — readiness สูง (คะแนน 4/5)
- Evidence-first: evidence ประกอบก่อน narrative, Fact Lock, "Raw rows never reach Qwen"
- Executable query plans (Phase 2B) — SQL grammar เป็น server-owned, user input กลายเป็น bound values เท่านั้น
- Deterministic tools (DateTime, Calculator, Web Search), fallback model, timeout 30s, body/history bounds, rate limit, security request interception, honest unavailable messaging (BRANCH_UNAVAILABLE, PRODUCT_MAPPING_UNAVAILABLE)
- Thresholds รวมศูนย์ (`EXECUTIVE_THRESHOLDS`), target เฉพาะเดือนเต็ม

### KAI-2 · Production parity ของ knowledge layer — กลาง → **P1 (ผูก MG-1)**
- **Issue:** KAI knowledge tables (0007–0020) เป็น ops migrations — prod-commission lineage ไม่ mark ชุดนี้; prod KAI อาจไม่มี knowledge layer
- **Evidence:** `drizzle/production-commission/0001_commission_prod_001.sql` comment, `drizzle/operations/0007-0020`
- **Business Impact:** KAI บน prod อาจตอบได้เฉพาะ deterministic/fallback หรือ error 503
- **Recommended Solution:** reconcile migration (MG-1) ก่อนประกาศ KAI ใช้งาน prod
- **Priority:** P1

### KAI-3 · Executive intelligence โหลดทั้งตารางต่อคำถาม — กลาง → **P2**
- **Issue:** `buildExecutiveSnapshot()` โหลด sales/booking/stock ทั้งหมดของบริษัททุกครั้ง
- **Evidence:** `lib/kai/executive-intelligence.ts:83-90`
- **Business Impact:** latency + cost ของทุก KAI executive question โตตามข้อมูล
- **Recommended Solution:** ใช้ period-filtered queries + server aggregation
- **Priority:** P2

---

## 17. Agriculture Module

### AG-1 · Production parity — agriculture เป็น local-only — กลาง → **P1 (ผูก MG-1)**
- **Issue:** agri migrations 0024–0040 เป็น local โดย design ("must not deploy, run remote migrations") — prod OPERATIONS_DB ไม่มี agri tables
- **Evidence:** `docs/KMM_WEATHER_AGRICULTURE_PHASE1_BASELINE.md`, `drizzle/operations/0024-0040`
- **Business Impact:** ฟีเจอร์ weather/agri บน prod แสดง "no data" หรือ error — ต้องมีแผน rollout ชัดเจน
- **Recommended Solution:** rollout plan แบ่งเฟส (master → locations → calendar → weather) พร้อม review
- **Priority:** P1

### AG-2 · Weather backend จำกัด (documented) — กลาง → **P2**
- **Issue:** ตาม audit baseline: ECMWF/GSMaP/GPM/Himawari/soil moisture ABSENT; rainfall anomaly/drought/flood ABSENT — UI จัดการ honesty ถูกต้อง (N/A) แต่ capability ยังไม่ครบ
- **Evidence:** `docs/KMM_WEATHER_AGRICULTURE_PHASE1_BASELINE.md` (ตาราง KMM_WEATHER_BACKEND_AUDIT)
- **Business Impact:** ยังไม่สามารถให้คำแนะนำ agronomic เชิงลึก (drought/flood) แก่ผู้ใช้
- **Recommended Solution:** เรียงลำดับโมเดลตาม impact (climatology/anomaly ก่อน, soil moisture ถัดไป)
- **Priority:** P2

### AG-3 · จุดแข็ง (verified)
- Schema provenance ครบ (source, confidence, verification, data gaps); API validation แข็งแรง (enum whitelist); KAI agriculture intent fail-closed (confidence ≥ 35); field verification workflow มี role/company check; `dataStatus: "needs_verification"` honesty

---

## 18. Future Scalability

### SC-1 · In-memory aggregation จะไม่ scale — กลาง → **P2**
- **Issue:** รูปแบบ "โหลดทั้งตาราง → aggregate ใน client/worker" (ดู API-1) จะพังเมื่อข้อมูลหลายปี/หลายบริษัท
- **Recommended:** server-side aggregation + period partition + วัด benchmark เป็นเกณฑ์ตัดสิน
- **Priority:** P2

### SC-2 · Multi-company เติบโต ต้องวาง sharding/partition — กลาง → **P2**
- **Issue:** ปัจจุบัน 2 DB + company_id scope OK; เพิ่มบริษัท/tenant จำนวนมากต้องมีกลยุทธ์ (shard ต่อ tenant? single ops DB ใหญ่?)
- **Recommended:** เอกสาร growth model + cap ต่อบริษัท
- **Priority:** P2

### SC-3 · Migration baseline ต้องเคลียร์ก่อนทุก rollout — สูง → **P1**
- **Issue/Impact/Recommended:** (ซ้ำ MG-1) — blocker ของ multi-company/agri/KAI prod
- **Priority:** P1

### SC-4 · จุดแข็ง
- Feature flags (`MULTI_COMPANY_ENABLED`), data-driven registries (source-definitions, map datasets), business_targets versioning, release-check workflow (`scripts/release-check.mjs`, `scripts/release.mjs`)

---

# ส่วนที่ 2: Roadmap การแก้ไข

## Phase 1 — Immediate (สัปดาห์ 1–2) · แก้ data integrity bug + quick wins

| # | งาน | Priority | ผูกกับ |
|---|---|---|---|
| 1.1 | **E1 booking age**: asOf required + server คำนวณตาม company TZ + tests | P0 | — |
| 1.2 | เพิ่ม index `(companyId, importYear, importMonth)` booking/stock | P1 | — |
| 1.3 | เติม `my.ts` ให้ครบ 394 keys (พร้อม translator review) + lint parity | P1 | — |
| 1.4 | เพิ่ม security headers (X-Frame/HSTS/Referrer-Policy/nosniff) | P2 | — |
| 1.5 | ตัด legacy JSON ออกจาก prod asset build | P2 | — |

**Exit criteria:** Typecheck/lint/test ผ่าน; ตัวเลข booking age ตรงกับวันจริง; my locale ไม่มี fallback ภาษาอังกฤษ

## Phase 2 — Short (สัปดาห์ 3–6) · แก้ P1 ของ KPI + validation

| # | งาน | Priority | ผูกกับ |
|---|---|---|---|
| 2.1 | **E2 canonical product taxonomy**: TS module + Data Hub validation + parity test (ตาม `docs/KMM_PRODUCT_TAXONOMY_DESIGN.md`) | P1 | — |
| 2.2 | **E3 targets → UI**: ต่อ `/api/sales` + dashboard bullet chart + sales plan chart (ใช้ `canEvaluateFullPeriodTarget` ร่วม KAI) | P1 | 2.3 |
| 2.3 | Reconcile migration: `wrangler d1 migrations list` ต่อ prod/staging → migration map + schema-drift check | P1 | — |
| 2.4 | KAI/prod knowledge layer rollout (หลัง 2.3) | P1 | 2.3 |
| 2.5 | Baseline performance measurement (bundle, D1 latency) | P2 | — |

**Exit criteria:** product classification ข้ามโมดูลสอดคล้อง (parity test); dashboard แสดง target achievement เฉพาะเดือนเต็ม; prod/staging schema ตรงกับ documented map

## Phase 3 — Medium (เดือน 2–3) · Governance + platform hardening

| # | งาน | Priority |
|---|---|---|
| 3.1 | Re-baseline COMPANY_DB lineage (ลบ/แยก ops tables) + แยก drizzle config ต่อ DB | P1 |
| 3.2 | Seed targets เป็น migration ที่ review (staging → prod) | P1 |
| 3.3 | Server-side aggregation สำหรับ `/api/sales`, `/api/operations`, executive intelligence | P2 |
| 3.4 | Module×role permission matrix (Data Hub write, settings, agri verification) | P2 |
| 3.5 | Data-quality job: ตรวจ legacy duplicate columns + junk product codes | P2 |
| 3.6 | `lib/business-rules/` รวมนิยามทางการ (as-of, taxonomy, target eligibility, thresholds) | P2 |

## Phase 4 — Long (เดือน 3–6) · Scale + product expansion

| # | งาน | Priority |
|---|---|---|
| 4.1 | Mobile 375px cross-role UAT gate (device matrix) + แก้ table overflow | P2 |
| 4.2 | Agriculture prod rollout (master → locations → calendar → weather) + weather model เพิ่ม (climatology/anomaly) | P1 |
| 4.3 | KM (Thailand) multi-company data + taxonomy company-scoped rows | P2 |
| 4.4 | Design System Stage 2/3: แทน hardcode hex ด้วย tokens, แก้ DS-1/DS-2 | P2 |
| 4.5 | Distributed rate limit สำหรับ KAI + observability (logs/traces) | P2 |
| 4.6 | Scalability: partitioning/aggregation benchmark, sharding strategy doc | P2 |

---

## ภาคผนวก

### สิ่งที่ยังต้องอาศัยข้อมูลเพิ่ม (ผูกข้อจำกัด static audit)
1. **wrangler/d1 access** — ยืนยัน schema จริงของ prod/staging (blocking ของ MG-1/KAI-2/AG-1)
2. **Test accounts 3 บทบาท + 2 บริษัท** — ยืนยัน permission/per-company behavior จริง
3. **Device matrix** — 375px UAT (blocking ของ MOB-1)
4. **Load environment** — วัด performance จริง (PERF-4, SC-1)
5. **Business confirmation** — stock EX/TP codes, ชะตากรรม junk codes, sourceVersion policy ของ targets

### ไฟล์ที่เกี่ยวข้อง
- Deep-dive P0/P1: `reports/static-audit-phase1-deepdive-p0p1.md`
- Design taxonomy: `docs/KMM_PRODUCT_TAXONOMY_DESIGN.md`
- รายงาน Phase 1: `reports/static-audit-phase1.md`
