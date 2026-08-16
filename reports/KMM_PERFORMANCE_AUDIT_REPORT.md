# KMM Dashboard — Full Performance & Stability Audit

**Status:** AUDIT ONLY — ยังไม่แก้โค้ด รอ approval ตามข้อกำหนด

**Method:** Static code audit + real local D1 measurement (payload sizes, row counts, `EXPLAIN QUERY PLAN`) + bundle/architecture analysis. Runtime metrics (LCP/INP) ต้องวัดบน staging หลัง apply — ระบุใน "Before/After measurement".

---

## 1. CURRENT PERFORMANCE ISSUES

### P0 — Critical (ส่งผลทุกหน้า / ไฟล์ใหญ่ / ข้อมูลขนาดใหญ่)

**P0-1. `/api/sales` ส่ง raw transactions ทั้งหมด (~2.2 MB) ให้ client คำนวณ KPI เอง**
- **Root cause:** `app/api/sales/route.ts` เรียก `listSalesTransactions` (`SELECT *` ทั้ง 3,417 rows) แล้วส่ง `sales: canonicalRows.map(toLegacySalesRow)` + `business` ทั้งหมด → client (dashboard/sales/team) ได้ทั้งชุด raw และต้อง filter/sum ซ้ำทุกครั้งที่ filter เปลี่ยน
- **Files:** `app/api/sales/route.ts`, `lib/sales/repository.ts` (`db.select().from(salesTransactions)` ไม่ select column), `lib/sales/business-service.ts`, `components/sales/sales-page.tsx`, `components/dashboard/dashboard-page.tsx`, `components/team/sales-organization-page.tsx`
- **Evidence:** local D1 = 3,417 rows × full columns ≈ **2,241 KB (2.19 MB)** ต่อ response; client คำนวณ branch/salesperson/product/monthly/weekly trend ซ้ำ (sales-page 1,461 บรรทัดไม่มี server-side aggregation)

**P0-2. `/api/operations` ส่ง booking+stock ทั้งหมด (~0.9 MB) + recompute business ฝั่ง client**
- **Root cause:** route ส่ง `booking` (407 rows) + `stock` (749 rows) + `business` พร้อมกัน; booking/stock pages รับ raw rows เพื่อ filter ฝั่ง client แทนการ filter ที่ D1
- **Files:** `app/api/operations/route.ts`, `lib/operations/repository.ts` (`SELECT *`), `components/booking/booking-intelligence-page.tsx`, `components/stock/stock-intelligence-page.tsx`
- **Evidence:** booking ≈ 329 KB + stock ≈ 567 KB = **~0.9 MB** ต่อ navigation; booking/stock pages เรียก `loadLiveOperationalData` (ไม่แชร์ cache กัน)

**P0-3. Marketing ยังโหลด legacy `dashboard-data.json` (1.8 MB) + geojson 11.4 MB — ไม่ผ่าน API/auth**
- **Root cause:** `marketing-intelligence-page.tsx` ใช้ `fetch("/dashboard-data.json?ts=…")` (legacy static, no auth, ไม่ใช่ D1) + `fetch("/maps/myanmar-townships.geojson")` (11.4 MB) แทน pmtiles (1.4 MB) ที่ GlobalVectorMap ใช้อยู่แล้ว
- **Files:** `components/marketing/marketing-intelligence-page.tsx:3038` (`/dashboard-data.json`), `:3064` (geojson), `public/dashboard-data.json` (1.8 MB)
- **Evidence:** geojson 11,429 KB vs pmtiles 1,379 KB (~8× ใหญ่กว่า); marketing ไม่เรียก `/api/sales` เลย

**P0-4. booking/stock queries เป็น FULL SCAN — ไม่มี index ครอบ `company_id`**
- **Root cause:** `listBookingTransactions` / `listStockTransactions` (`WHERE company_id = ? ORDER BY date`) แต่ตารางมีแค่ PK autoindex; migration `0041_operations_indexes.sql` (งาน 1.2) **ยังไม่ได้ apply** ใน D1 ใดๆ
- **Files:** `lib/operations/repository.ts`, `drizzle/operations/0041_operations_indexes.sql` (ไม่ apply)
- **Evidence (EXPLAIN QUERY PLAN):**
  - booking: `SCAN booking_transactions` + `USE TEMP B-TREE FOR ORDER BY`
  - stock: `SCAN stock_transactions` + `USE TEMP B-TREE FOR ORDER BY`
  - sales: `SEARCH … USING INDEX sales_scope_invoice_idx (company_id=?)` แต่ยัง `USE TEMP B-TREE FOR ORDER BY` (index ไม่มี sale_date)

**P0-5. ทุก request ผ่าน Auth + company-context re-query เต็มชุด**
- **Root cause:** ทุก API call เรียก `requireCompanyContext` → `verifyFirebaseRequest` (JWKS cache ดี) + `listAuthorizedCompaniesForUser` (query company_users+companies) + `enrichAuthorizedCompanies` (3 queries: currencies/localizations/branches) — query ชุดนี้ซ้ำทุก request
- **Files:** `lib/server/company-context.ts`, `app/api/sales/route.ts`, `app/api/operations/route.ts`, `app/api/company-context/route.ts`
- **Impact:** ทุก navigation ของทุกหน้า → อย่างน้อย 1 request auth + 4-5 queries company DB ก่อน data หลัก; `cache: "no-store"` ทุกที่ (ไม่มี HTTP cache)

### P1 — High

**P1-1. ไม่มี React.memo/useMemo ในหน้าหลัก → re-render ต้นทุนสูง**
- **Root cause:** `dashboard-page.tsx` 1,613 บรรทัด **0 ครั้ง** `useMemo`/`memo`; ทุก filter change → recompute ทั้งหน้าผ่าน `rowMatches` × หลาย `filter()` (sparkline เรียก per month); marketing 4,001 บรรทัด + booking/stock ~1,000 บรรทัด
- **Files:** `components/dashboard/dashboard-page.tsx` (0 memo, filter-loop 240-499), `components/marketing/marketing-intelligence-page.tsx`, `components/booking/booking-intelligence-page.tsx`, `components/stock/stock-intelligence-page.tsx`
- **Evidence:** `monthlySparkline` ใช้ `rows.filter` per month (240), `buildRecentActivities` 3× `rowMatches` (1361-1379)

**P1-2. ไม่มี lazy loading / route-level splitting**
- **Root cause:** ไม่มี `next/dynamic` หรือ `Suspense` ในแอป (grep = 0); ทุก page import component ตรงใน `app/*/page.tsx` → main bundle ใหญ่
- **Files:** `app/dashboard|sales|booking|stock|marketing|weather|data-hub` page.tsx (ทั้งหมด static import), `components/kai/kai-header-assistant.tsx` (KAI อยู่ใน global header ทุกหน้า = ถูกโหลดทุกหน้าแม้ไม่ใช้)
- **Evidence:** ไม่มี `loading.tsx`/`error.tsx` ระดับ route เลย (`ls app/*/loading.tsx` = none); KAI assistant + PresentationLayout mount ทุกหน้า

**P1-3. Firebase storage + auth bundle ถูกโหลดทุกหน้า**
- **Root cause:** `lib/firebase.ts` export `auth` + `storage`; 10 ไฟล์ import `lib/firebase` (auth-gate ทุกหน้า, sidebar, clients) → firebase/storage ใน initial bundle แม้ storage ใช้แค่ company-management
- **Files:** `lib/firebase.ts`, `components/auth/auth-gate.tsx`, `components/navigation/app-sidebar.tsx`, `components/data-hub/*`, `src/context/CompanyContext.tsx`
- **Impact:** +storage SDK ใน main chunk; auth-gate ทุก navigation ต้อง `onAuthStateChanged` + 5s fallback timeout

**P1-4. 15 font files @fontsource blocking CSS**
- **Root cause:** `app/layout.tsx` import 15 CSS (@fontsource IBM Plex Thai 8 ไฟล์ + Noto Sans Myanmar 7 ไฟล์) — render-blocking ทั้งหมด
- **Files:** `app/layout.tsx`
- **Impact:** FMP ช้าลงในทุกหน้า (TH + MM font หลาย weight)

**P1-5. ไม่มี Error Boundary ระดับ app**
- **Root cause:** ไม่มี `componentDidCatch`/`error.tsx`/ErrorBoundary ในโค้ด (grep = 0 ใน src/components)
- **Files:** ทั้งแอป
- **Impact:** runtime crash = blank page; ไม่มี fallback UI

### P2 — Medium

**P2-1. Dashboard-data.json legacy ยังถูก reference ใน fallback paths**
- `lib/sales/client.ts:33`, `lib/operations/client.ts` (local QA fallback) + marketing ใช้ตรง — งาน 1.5 (ตัด legacy) ยังไม่ทำ; marketing ต้องย้ายก่อน

**P2-2. `SELECT *` ใน repository ทั้งหมด**
- `lib/sales/repository.ts`, `lib/operations/repository.ts` ใช้ `db.select().from(table)` (ทุก column) — ไม่ select เฉพาะ column ที่ UI ใช้

**P2-3. Chart rendering: SVG inline + re-render ทุก filter change**
- `components/common/charts/*` SVG ล้วน (ดี ไม่มี lib หนัก) แต่จุดที่ผ่าน props ใหม่จาก filter → re-render ทั้ง chart; `LegacyLineChart` ยังอ้างอิงใน dashboard (audit เก่า noted)

**P2-4. Map: marketing maplibre double-loads geojson + labels**
- marketing `myanmar-marketing-map.tsx` import `myanmar-marketing-map-maplibre.tsx` (dynamic import maplibre-gl ดี) แต่ page โหลด geojson 11.4MB แยก; agriculture/weather ใช้ pmtiles 1.4MB ถูกต้อง

**P2-5. Loading states ไม่สม่ำเสมอ**
- dashboard/booking/stock/sales มี `LoadingSkeleton` ดี; marketing/data-hub ใช้ spinner ง่าย; ไม่มี route-level `loading.tsx`

---

## 2. ROOT CAUSE SUMMARY

| หมวด | Root cause |
|---|---|
| Payload ใหญ่ | Server ส่ง raw rows ทั้งหมด; aggregation อยู่ฝั่ง client (`business-service` ถูก import ใน client bundle) |
| DB ช้า | Migration 1.2 (compound indexes) ไม่ apply; repository ใช้ `SELECT *`; ไม่มี index ครอบ `(company_id, date)` |
| Duplicate requests | แต่ละหน้า mount ใหม่ → re-fetch เต็ม (ไม่แชร์ cache/ไม่ dedupe); `cache:"no-store"` ทุกที่ |
| Re-render | Monolithic pages (1,600-4,000 บรรทัด) ไม่มี memo; filter-loop ซ้ำ |
| Bundle | ไม่มี lazy/suspense; KAI + firebase/storage + 15 fonts ใน initial chunk ทุกหน้า |
| Marketing | ยังผูก legacy static (`dashboard-data.json` + geojson) ไม่ได้ย้ายมา API/D1 |

---

## 3. FILES AFFECTED (โดยสรุป)

- **API/payload:** `app/api/sales/route.ts`, `app/api/operations/route.ts`, `lib/sales/repository.ts`, `lib/operations/repository.ts`, `lib/sales/business-service.ts`, `lib/operations/business-service.ts`, `lib/sales/client.ts`, `lib/operations/client.ts`
- **DB:** `drizzle/operations/0041_operations_indexes.sql` (รอ apply), `db/schema.ts`
- **Frontend (monolith):** `components/dashboard/dashboard-page.tsx`, `components/sales/sales-page.tsx`, `components/booking/booking-intelligence-page.tsx`, `components/stock/stock-intelligence-page.tsx`, `components/marketing/marketing-intelligence-page.tsx`, `components/team/sales-organization-page.tsx`
- **Shell/bundle:** `app/layout.tsx` (fonts), `components/layout/global-app-shell.tsx`, `components/layout/global-header.tsx` (KAI), `components/auth/auth-gate.tsx`, `lib/firebase.ts`, `components/kai/kai-header-assistant.tsx`
- **Marketing legacy:** `components/marketing/marketing-intelligence-page.tsx` (dashboard-data.json + geojson), `public/dashboard-data.json`, `public/maps/myanmar-townships.geojson`

---

## 4. RECOMMENDED FIXES (จัดลำดับ)

| # | Fix | Files | ประมาณการ gain |
|---|---|---|---|
| F1 | **Server-side aggregation**: /api/sales, /api/operations ควรคำนวณ KPI/trend/summary ที่ worker แล้วส่งชุด compact (ไม่ส่ง raw rows ทั้งหมด) — เก็บ raw rows ต่อเมื่อ filter-by-page ต้องการ | routes + repository | payload 2.2MB → ~50-100KB |
| F2 | **Apply migration 0041** (booking/stock compound indexes) + เพิ่ม `(company_id, sale_date)` index | drizzle migration + schema | full scan → index seek |
| F3 | **Marketing ย้ายจาก dashboard-data.json + geojson → API/D1 + pmtiles** | marketing-intelligence-page, sales API | 1.8MB + 11.4MB → ~1.4MB (pmtiles) + auth |
| F4 | **Split + memoize หน้าหลัก**: useMemo per chart section, React.memo บน card/table; ย้าย compute-heavy logic ออกจาก render | dashboard/sales/booking/stock pages | ลด re-render อย่างมีนัย |
| F5 | **Lazy load**: KAI assistant, maps, marketing page ผ่าน `next/dynamic`; route-level `loading.tsx` | layout/global-header/pages | ลด initial bundle |
| F6 | **Dedupe requests**: shared client cache per companyId + window event (`kmm:data-loaded`) แทน re-fetch ทุก mount | lib/*/client.ts | navigation เร็วขึ้น |
| F7 | **Firebase split**: แยก auth/storage import; ลด font CSS (เฉพาะ weight ที่ใช้ หรือ font-display swap) | lib/firebase.ts, layout.tsx | ลด initial chunk |
| F8 | **Error Boundary + route error.tsx** | new components/error-boundary + app/*/error.tsx | stability |
| F9 | งาน 1.5: ตัด legacy `dashboard-data.json` หลัง marketing ย้าย | public/, clients | remove 1.8MB static |

**ข้อจำกัด:** F1/F3/F4 ต้องตรวจสอบกับ regression tests (`sales-regression`, `live-dashboard-completion`, `dashboard-source-safety`, `sales-live-integration`, `booking/stock-regression`) — หลาย test ผูกกับ payload shape และ fallback path.

---

## 5. BEFORE/AFTER MEASUREMENT (ค่าที่วัดได้จาก local + ประมาณการหลัง fix)

| Metric | Before (measured) | After (target) | วิธีวัด |
|---|---|---|---|
| `/api/sales` payload | **2,241 KB** (3,417 rows) | ~100 KB (aggregated) | local D1 json size |
| `/api/operations` payload | **~900 KB** (407+749 rows) | ~80 KB (summaries) | local D1 json size |
| marketing static | **1,837 KB** (dashboard-data.json) + **11,429 KB** (geojson) | 0 + ~1,400 KB (pmtiles) | file size |
| booking query plan | `SCAN` + temp b-tree | `SEARCH` (index) | `EXPLAIN QUERY PLAN` |
| stock query plan | `SCAN` + temp b-tree | `SEARCH` (index) | `EXPLAIN QUERY PLAN` |
| sales query plan | index on company only + temp b-tree | index (company, sale_date) | `EXPLAIN QUERY PLAN` |
| Dashboard first meaningful render (desktop) | ยังไม่ได้วัด (ไม่มี staging) | **< 2s** | staging: LCP/FMP |
| Mobile FMP | ยังไม่ได้วัด | **< 3s** | staging device lab |
| React re-render | monolith 1,600-4,000 บรรทัด, 0 memo | memoized sections | React DevTools profiler |

> ⚠️ Runtime target (<2s / <3s) ต้อง validate บน staging หลัง apply F1-F5 — งานนี้ไม่สามารถวัด production TTFB ได้จาก local audit อย่างเดียว

---

## 6. OUT OF SCOPE (ตามคำสั่ง — ไม่แตะ)
- Database schema / API contract (F1/F2/F4 ต้องคง contract เดิม หรือทำเป็น additive response + fallback ตาม test)
- Business logic / features ใหม่ — audit เท่านั้น

**READY_FOR_APPROVAL = YES — รออนุมัติก่อนลงมือ งานแนะนำเริ่มที่ F2 (apply index) → F3 (marketing ย้าย) → F1 (payload)**
