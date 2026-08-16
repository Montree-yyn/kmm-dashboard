# Roadmap Phase 1 — Implementation Plan (งาน 1.1–1.5)

> เอกสารนี้เป็น **plan เท่านั้น** — ไม่มีการแก้ไขโค้ด ไม่ commit ไม่ deploy ไม่เปลี่ยน database
> หลักฐานอ้างอิง file:line จากสถานะ repo ณ วันที่ audit (15 ส.ค. 2026)

---

## 0. สรุปภาพรวม

| # | งาน | Priority | ประเภทการเปลี่ยน | Batch | ขึ้นกับ |
|---|---|---|---|---|---|
| 1.1 | E1 Booking age แช่แข็ง | **P0** | โค้ด + API + tests | A | — |
| 1.4 | Security headers | P2 | โค้ด (worker) + tests | A | — |
| 1.3 | Myanmar locale (my.ts) | P2 | เนื้อหา (translation) + tests | A | ต้องมี translator/เจ้าของภาษา |
| 1.2 | Index booking/stock | P1 | **DB migration** (staging-first) | B | A1/F1 (lineage decision), `wrangler d1` access |
| 1.5 | ตัด legacy JSON | P2 | โค้ด + ลบไฟล์ + test surgery | B → C | การตัดสินใจ data home ของ marketing |

**ลำดับที่แนะนำ: 1.1 → 1.4 → 1.3 (Batch A) → 1.2 (Batch B) → 1.5 (Batch B/C)**

เหตุผล:
- **1.1 มาก่อนเสมอ** — เป็น P0 ตัวเลขผิดในวันนี้ และแยกอิสระจากงานอื่น 100%
- **Batch A (1.1 → 1.4 → 1.3)** — โค้ด/เนื้อหาล้วน ไม่แตะ DB ลงได้ในรอบ deploy เดียว 1.3 ควรทำคู่กับ 1.1/1.4 เพราะไม่ต้องรอใคร (แต่ต้องมีคนตรวจภาษา)
- **Batch B (1.2)** — แตะ DB ต้อง staging-first + ผูกกับ decision A1/F1 (migration topology) จึงจัดทีหลัง
- **Batch C (1.5)** — blast radius ใหญ่สุด (marketing ยังไม่มี data home ใน D1, KAI heatmap พึ่ง JSON, tests ผูกกับ static fingerprints) ทำท้ายสุดเป็นขั้นตอนย่อย 3 ขั้น

---

## 1. งาน 1.1 — E1 Booking Age แช่แข็ง (P0)

### 1.1.1 หลักฐาน
| จุด | ไฟล์:บรรทัด | สถานะ |
|---|---|---|
| Hardcode date | `lib/dashboard/booking-selectors.ts:72` | `bookingAge(row, asOf = new Date("2026-07-11T00:00:00"))` — **default แช่แข็ง** |
| เรียกแบบไม่มี asOf | `lib/dashboard/booking-selectors.ts:73` | `getAverageBookingAge` เรียก `bookingAge(row)` |
| UI booking | `components/booking/booking-intelligence-page.tsx:162` | `age(row)` → `bookingAge(row)` → ใช้ใน `risk()` (bucket 30/60/90) + escalate + export CSV |
| API operations | `lib/operations/business-service.ts:15` | `averageAge: getAverageBookingAge(booking, filters)` ผ่าน `/api/operations` |
| Regression test ผูก text | `tests/booking-regression.test.mjs:18` | assert `getAverageBookingAge(data.booking, filters)` ในหน้า page — **ต้องอัปเดตเมื่อ signature เปลี่ยน** |

ผลกระทบ ณ วันนี้ (15 ส.ค. 2026): อายุต่ำกว่าจริง ~35 วัน → bucket ผิด (Critical ">90" แสดงเป็น At Risk "61–90") → escalate list (`age > 90`) หาย, heatmap/export CSV ผิด

### 1.1.2 Design

**หลักการ: ตัด default ออก — asOf ต้องมาจาก server เสมอ (ไม่มี client-side "today" หลุด)**

1. **`bookingAge(row, asOf: Date)`** — ลบ default ออกจาก signature → compiler บังคับทุก caller ส่งค่า (แก้ได้ครั้งเดียว จับได้ถาวร)
2. **`getAverageBookingAge(rows, filters, asOf: Date)`** — ส่ง asOf ต่อลงไป
3. **Server เป็นเจ้าของ "business today"** — `/api/operations` คำนวณ asOf จาก `context.timeZone` (มีแล้วใน `lib/company-context/types.ts:27` + `lib/server/company-context.ts:291` — `Asia/Bangkok`/`Asia/Yangon`) แล้วตอบกลับใน payload:
   - `getOperationalBusiness(booking, stock, filters, { asOf })` — เพิ่ม options object (backward-compatible)
   - Response เพิ่ม field `asOf: "2026-08-15"` (วันที่แบบ company TZ)
4. **Client แค่ render** — booking page อ่าน `asOf` จาก payload → `bookingAge(row, asOf)` / `getAverageBookingAge(rows, filters, asOf)`
5. **Local-fallback QA** (`lib/operations/client.ts` — ไม่ใช่ production) — ใช้ `meta.sourceUpdatedAt` ของไฟล์ถ้ามี, ไม่มีก็ใช้วันนี้ (QA mode เท่านั้น ไม่กระทบ prod)

### 1.1.3 ไฟล์ที่ต้องแตะ
| ไฟล์ | การเปลี่ยน |
|---|---|
| `lib/dashboard/booking-selectors.ts` | ลบ default; `bookingAge(row, asOf: Date)`; `getAverageBookingAge(..., asOf: Date)` |
| `lib/operations/business-service.ts` | เพิ่ม options `{ asOf }`; ส่งต่อให้ `getAverageBookingAge` |
| `app/api/operations/route.ts` | คำนวณ asOf จาก `context.timeZone`; ใส่ใน response |
| `lib/operations/client.ts` | type `LiveOperationalData` + asOf (เพิ่ม field; fallback ใช้ sourceUpdatedAt/วันนี้) |
| `components/booking/booking-intelligence-page.tsx` | `age(row)` รับ asOf; ผ่าน payload |
| `lib/operations/types.ts` | `OperationalBusiness` options type |
| `tests/booking-regression.test.mjs` | อัปเดต text assertion (ตอนนี้ assert รูปแบบเดิมที่ไม่มี asOf) |
| tests ใหม่ | unit test bucket boundary + API contract (ดู 1.1.4) |

### 1.1.4 Acceptance Criteria
- **AC-1.1.1** `bookingAge` / `getAverageBookingAge` ไม่มี default date — signature บังคับ `asOf: Date` (typecheck จับได้ถาวร ไม่มี caller หลุด)
- **AC-1.1.2** `GET /api/operations` ตอบ `asOf` เป็นวันที่ของ company time zone (ไม่ใช่ UTC แบบตรง) และ `business.booking.averageAge` คำนวณด้วย asOf นั้น
- **AC-1.1.3** booking page ใช้ asOf จาก payload เท่านั้น — ไม่มี `new Date()` สำหรับ asOf ใน client path (production)
- **AC-1.1.4** Unit tests ใหม่: `bookingAge` boundary ที่ 30/60/90 วัน (bucket เปลี่ยนถูก), วันที่ว่าง/ไม่ valid → 0, `getAverageBookingAge` ค่าเฉลี่ยถูก
- **AC-1.1.5** Regression tests ที่ผูก text อัปเดตครบ (`booking-regression`, `live-dashboard-completion`, `kai-header-regression` ถ้า assert รูปแบบ) — `npm test` เขียวทั้งชุด (41 ไฟล์ใน suite)
- **AC-1.1.6** `npx tsc --noEmit` 0 error, `npm run lint` 0 error
- **AC-1.1.7** KAI ไม่ได้รับผล (ตรวจแล้ว: KAI ใช้แค่ `getOpenBookingUnit`/`getBookingValue` — ไม่คำนวณ age) — ยืนยันด้วย test suite เดิมเขียว

### 1.1.5 ความเสี่ยง / หมายเหตุ
- Comment "Legacy parity expression retained" ใน booking page (บรรทัด 36–37) ต้องอัปเดตให้ตรงกับ signature ใหม่
- วันที่ 2026-07-11 ต้องถามเจ้าของ rule ว่าเป็น snapshot date ของข้อมูลหรือวันที่ arbitrary — ถ้า data ถูก freeze ตาม snapshot ต้องใช้ `meta.sourceUpdatedAt` แทน "วันนี้" (decision เปิด — default design ใช้ company-TZ today)

---

## 2. งาน 1.2 — Index booking/stock transactions (P1)

### 2.1 หลักฐาน
| จุด | ไฟล์ | สถานะ |
|---|---|---|
| ตาราง booking | `drizzle/operations/0003_operations_booking.sql` | CREATE TABLE **ไม่มี index** |
| ตาราง stock | `drizzle/operations/0004_operations_stock.sql` | CREATE TABLE **ไม่มี index** |
| ตารางชุดเดียวกันใน lineage COMPANY_DB | `drizzle/0005_harsh_ser_duncan.sql` | **สร้างซ้ำ** ใน main lineage — topology issue A1/F1 |
| Query sites | `lib/operations/repository.ts:7,12` | `WHERE company_id = ? ORDER BY booking_date / as_of_date` |
| Callers | `/api/operations`, `/api/daily-management`, `lib/kai/executive-intelligence.ts:90`, `lib/kai/tools/kmm-business.ts:658,681` | ทุก query ผ่าน repository เดียวกัน |

### 2.2 Design
Migration ใหม่ `drizzle/operations/0041_operations_indexes.sql` (ตัวล่าสุดคือ 0040):

```sql
CREATE INDEX IF NOT EXISTS `booking_transactions_company_date_idx`
  ON `booking_transactions` (`company_id`, `booking_date`);
CREATE INDEX IF NOT EXISTS `stock_transactions_company_date_idx`
  ON `stock_transactions` (`company_id`, `as_of_date`);
```

- **Mechanics:** `drizzle/operations/` ไม่มี meta journal (ตรวจแล้ว) — wrangler ใช้ `migrations_dir` ใน `wrangler.operations.jsonc` ไล่ตามลำดับ filename → แค่เพิ่มไฟล์ 0041, `wrangler d1 migrations apply` (staging ก่อน)
- **Reverse (rollback):** บันทึก `DROP INDEX` statements ไว้ใน doc/comment ของ migration (หรือ migration 0042) — มาตรฐานของ repo ยังไม่มี pattern rollback ชัดเจน ให้เลือกตามที่ทีมใช้กับ 0036–0040
- **Optional (ตรวจก่อน):** import path ของ data-hub อาจ query ด้วย `import_id`/`import_year`/`import_month` — ถ้า import-service ทำ lookup แบบนั้นจริง เพิ่ม index `(company_id, import_year, import_month)` ไปพร้อมกันได้ (ถูก, ขนาดเล็ก)

### 2.3 Topology note (ผูก A1/F1)
`drizzle/0005_harsh_ser_duncan.sql` (lineage COMPANY_DB) สร้างตารางคู่นี้ด้วย — **ต้องตัดสินใจ**: ถ้า lineage นั้นยังถูก apply อยู่ที่ไหน จะต้องใส่ index DDL ให้ครบทั้งสอง lineage ไม่งั้น schema drift (ซึ่งเป็นปัญหา A1/F1 อยู่แล้ว) — **decision นี้ทำในงาน reconcile migration (Phase 2) ได้ แต่ 1.2 ต้องบันทึกการตัดสินใจไว้ใน PR**

### 2.4 Acceptance Criteria
- **AC-1.2.1** `drizzle/operations/0041_operations_indexes.sql` มีอยู่ ใช้ `IF NOT EXISTS`, ครอบคอลัมน์ `(company_id, booking_date)` และ `(company_id, as_of_date)`
- **AC-1.2.2** Apply ไป **staging** OPERATIONS_DB สำเร็จ (ผ่าน `wrangler.operations.jsonc`) — ตรวจ `PRAGMA index_list('booking_transactions')` และ `stock_transactions`
- **AC-1.2.3** `EXPLAIN QUERY PLAN` ของ `listBookingTransactions`/`listStockTransactions` แสดงการใช้ index (ไม่ใช่ table scan)
- **AC-1.2.4** ไม่มีการเปลี่ยน schema/data นอกเหนือ index — `npm test` เขียว (multi-company-isolation, kai-stock-parity, data-hub tests ยังผ่าน)
- **AC-1.2.5** Decision บันทึกแล้ว: จะ mirror DDL ไป lineage COMPANY_DB (`drizzle/0005`) หรือไม่ + เหตุผล (ผูก A1/F1)
- **AC-1.2.6** **ห้าม apply ไป production** ก่อน staging ผ่าน และก่อนเคลียร์ topology decision — ตาม constraint ของ audit

---

## 3. งาน 1.3 — Myanmar locale ให้ครบ (my.ts)

### 3.1 หลักฐาน
- `src/locales/en.ts` = **394 keys**, `th.ts` = **394 keys**, `my.ts` = **216 keys** → **ขาด 178 keys (45%)**
- Fallback เงียบ: `src/locales/index.ts` — `translate()` คืน `locales[language][key] ?? locales.en[key] ?? key` → ผู้ใช้ Myanmar เห็นอังกฤษโดยไม่มีสัญญาณเตือน
- ไม่มี test ยืนยัน key parity — `tests/localization-regression.test.mjs` ตรวจแค่ key ตัวอย่าง 5 ตัวต่อ locale + โครงสร้าง index
- Font พร้อมแล้ว: `app/globals.css` โหลด Noto Sans Myanmar + `data-locale="my"` (test ยืนยัน)

### 3.2 Design
1. **เติม 178 keys** ใน `src/locales/my.ts` — source of truth = `th.ts` (default language เป็นไทย; แปลจาก semantics ไทย → พม่า) โดยรักษา:
   - ชื่อ key ตรงกับ en/th เป๊ะ
   - format string เหมือนเดิม (placeholders `{year}`, `{count}` ฯลฯ ต้องไม่หาย)
2. **เพิ่ม parity test** ใหม่ (เช่น `tests/locale-parity.test.mjs`):
   - key set ของ en / th / my **เท่ากันทุกตัว** (ขาด = fail, เหลือเกิน = fail)
   - ค่าใน my.ts ไม่มี empty string
   - (option) เตือนถ้ามี key ที่ format placeholder ไม่ตรงกับ en
3. **ไม่มี fallback เงียบ**: หลัง parity test เขียว `translate()` ยังทำงานเหมือนเดิม (defensive) แต่ data รับประกันว่าครบ

### 3.3 เกณฑ์คนตรวจ (Data-quality gate — ไม่ automate ได้)
- 178 keys ต้องผ่านการตรวจโดย **เจ้าของภาษาพม่า** (หรือ glossary ที่ approved) ก่อน merge — เรื่องคุณภาพการแปลอยู่นอก automation

### 3.4 Acceptance Criteria
- **AC-1.3.1** key set ของ en/th/my เท่ากัน (parity test ใหม่ผ่าน)
- **AC-1.3.2** `my.ts` มี 394 keys, ไม่มีค่า empty, placeholder ตรงกับ en ทุก key ที่มี placeholder
- **AC-1.3.3** Spot-check UI: nav, route titles, daily report (publish), booking aging labels, settings — แสดงพม่าครบ ไม่มีอังกฤษแทรกใน my locale
- **AC-1.3.4** `localization-regression` + `map-foundation` + ชุด regression เดิมเขียว; `npm test` ทั้งชุดเขียว
- **AC-1.3.5** ผ่านการตรวจภาษาโดยเจ้าของภาษาก่อน merge (sign-off บันทึกใน PR)

---

## 4. งาน 1.4 — Security Headers (P2)

### 4.1 หลักฐาน
- มี header ตัวเดียวใน repo: `X-Content-Type-Options: nosniff` เฉพาะ `app/api/daily-management/template/route.ts:12`
- **ไม่มี** CSP / HSTS / X-Frame-Options / Referrer-Policy / Permissions-Policy ที่ไหนเลย (search ทั่ว repo ยืนยัน)
- โปรเจกต์เป็น **Cloudflare Worker + Assets** (`wrangler.json` — `main: dist/server/index.js`, `assets.directory: dist/client`), framework vinext (ไม่มี `next.config.*`)
- Entry จุดเดียว: `worker/index.ts` — `handler.fetch(request, env, ctx)` เป็นทางผ่านสุดท้ายของทุก request (ยกเว้น pmtiles + image optimizer ที่ return ก่อน)

### 4.2 Design — 2 ระยะ (CSP ต้อง report-only ก่อน)

**ระยะ 1 (ใน scope งาน 1.4): hardening headers**
- ใน `worker/index.ts` สร้าง helper `withSecurityHeaders(response)` แล้ว wrap **ทุก return point** (รวม pmtiles/image):
  - `X-Frame-Options: SAMEORIGIN` (app ไม่ใช้ iframe — SAMEORIGIN ปลอดภัยพอ และเหลือช่องให้ฝังใน future)
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (มีผลเฉพาะ HTTPS — dev ที่ http://localhost ไม่ส่ง header ตาม spec — บันทึกใน docs)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

**ระยะ 2 (อยู่นอก scope 1.4 — เขียนเป็น dependency): CSP**
- เริ่มจาก `Content-Security-Policy-Report-Only` บน staging + เก็บ violations
- ต้องจัดการกับ: MapLibre blob: workers, inline styles, Firebase SDK (`gstatic`/`googleapis`), Google Fonts, KAI streaming, image optimizer endpoint, pmtiles
- หลังทบทวน report แล้วค่อยบังคับใช้จริง (งาน Phase 2)

**ข้อควรระวัง:** Static assets (dist/client) เสิร์ฟผ่าน ASSETS binding — ต้องยืนยันว่า `handler.fetch` (vinext entry) ครอบทุก response รวม static; ถ้า asset ใด bypass worker ต้องใส่ header ผ่าน `_headers` ของ Cloudflare (แล้วแต่ผลตรวจ) — **ใส่ใน acceptance criteria**

### 4.3 Acceptance Criteria
- **AC-1.4.1** `worker/index.ts` มี `withSecurityHeaders` (หรือเทียบเท่า) ครอบทุก return point; response ทุกรายการมี header ครบ 5 ตัว (X-Frame, HSTS, nosniff, Referrer-Policy, Permissions-Policy)
- **AC-1.4.2** `curl -sI` ต่อ staging แสดงครบ 5 ตัวทั้งหน้า HTML และ API; asset ที่ไม่ผ่าน worker (ถ้ามี) ถูกจับได้และแก้ด้วย `_headers`
- **AC-1.4.3** CSP-Report-Only ถูก deploy บน staging พร้อมกลไกเก็บ violations; review แล้วไม่มี critical violation จาก flow หลัก (map, KAI, Firebase, image optimizer)
- **AC-1.4.4** Test ใหม่ assert ชื่อ header ทั้ง 5 ใน `worker/index.ts` (ตาม style regression test ของ repo)
- **AC-1.4.5** `npm test` เขียว; tsc/lint สะอาด; dev local (http) ทำงานปกติ (document ว่า HSTS ไม่ active บน http)

---

## 5. งาน 1.5 — ตัด Legacy JSON (`public/dashboard-data.json`, 1.8MB)

### 5.1 หลักฐาน — 4 กลุ่มผู้ใช้
| ผู้ใช้ | ไฟล์:บรรทัด | สถานะ |
|---|---|---|
| Sales client fallback | `lib/sales/client.ts:33` | ปิดใน production แล้ว (throw) — เหลือเพื่อ local QA |
| Operations client fallback | `lib/operations/client.ts:27` | gate ด้วย `NEXT_PUBLIC_OPERATIONS_LOCAL_FALLBACK === "true"` + ปิดใน prod — เหลือเพื่อ local QA |
| **Marketing page** | `components/marketing/marketing-map-page.tsx:96,99` + `marketing-intelligence-page.tsx:3038` | **fetch ตรงแบบไม่มี env gate — รั่วใน production** |
| **Server-side heatmap (KAI)** | `lib/marketing/sales-area-service.ts:129` (`assets.fetch` ผ่าน ASSETS binding) เรียกโดย `lib/kai/tools/kmm-business.ts:638` | **พึ่ง JSON ใน production จริง — ไม่มีทางเลือก D1** |

ข้อเท็จจริงสำคัญ:
- **ไม่มี `/api/marketing/*` route ใดๆ** (glob ยืนยัน) — marketing data (`data.marketing`) ยังไม่มีตาราง/import ใน D1
- Tests อ่านไฟล์ตรง: `tests/dashboard-source-safety.test.mjs` (assert static fingerprints: 1,712 units / 75 stock) + `tests/model-normalization-regression.test.mjs`
- Script สร้างไฟล์: `npm run update-data` → `scripts/build_dashboard_data.py`

### 5.2 Design — 3 ขั้นตอน

**5.5a (Batch B) — ปิด production consumption ทันที (ปลอดภัย, ทำก่อน)**
1. Marketing pages: เปลี่ยนเป็น pattern เดียวกับ operations client — fetch ผ่าน env gate `NEXT_PUBLIC_OPERATIONS_LOCAL_FALLBACK` + throw ใน production (หรือ API-first ถ้าทำได้)
2. `sales-area-service.ts`: fail-closed ใน production (`throw` ถ้าไม่ใช่ local QA) — KAI heatmap tool จะรายงาน error ชัดเจนแทนข้อมูลเก่าเงียบ ๆ จนกว่าจะมี source ใหม่
3. **Decision ที่ต้องเปิด:** marketing data ควรมี D1 home (ตาราง `marketing_activities` + import + API) หรือไม่ — ถ้าใช่ งานสร้าง API เป็น **Phase 2** (และควรใช้ canonical product taxonomy จาก E2 ในการ aggregate)

**5.5b (Batch C) — ลบไฟล์ + test surgery**
1. ลบ `public/dashboard-data.json`
2. อัปเดต tests: `dashboard-source-safety` (fingerprints 1712/75 กลายเป็น obsolete → เปลี่ยนเป็น assert รูปแบบ API contract หรือลบ fingerprint test) + `model-normalization-regression` (อ่านจาก fixture แทน เช่น `tests/fixtures/`)
3. ยืนยัน `dist/client` ที่ build ไม่มี `dashboard-data.json`
4. Decision: ชะตากรรม `scripts/build_dashboard_data.py` — เก็บไว้สร้าง fixture สำหรับ local QA (เขียนไป `tests/fixtures/` ไม่ใช่ `public/`) หรือลบ

**5.5c (Batch C) — ทำความสะอาด fallback ที่เหลือ**
- ถอด branch fallback ใน `lib/sales/client.ts` / `lib/operations/client.ts` (หรือย้ายไปอยู่หลัง flag local-only ชัดเจน)
- ตรวจไม่เหลือ `fetch("/dashboard-data.json")` ใน client components ใด ๆ

### 5.3 Acceptance Criteria
- **AC-1.5.1** ไม่มี client component ใด fetch `/dashboard-data.json` ใน production path (marketing gated เหมือน operations; search ทั่ว repo ยืนยัน)
- **AC-1.5.2** `sales-area-service` ไม่อ่าน static asset ใน production (fail-closed หรือ D1-backed) — KAI heatmap tool มี error path ที่ชัดเจน
- **AC-1.5.3** `public/dashboard-data.json` ถูกลบ; build (`npm run build`) แล้ว `dist/client` ไม่มีไฟล์นี้
- **AC-1.5.4** Tests ที่อ่านไฟล์ถูกย้าย/อัปเดต (`dashboard-source-safety`, `model-normalization-regression`) — `npm test` เขียวทั้งชุด
- **AC-1.5.5** Marketing page ทำงานบน staging ด้วย live data (หรือ error ชัดเจนในกรณีไม่มี data) — ยืนยันด้วยมือบน staging
- **AC-1.5.6** Decision เรื่อง marketing D1 home + ชะตากรรม build script บันทึกใน PR/issue
- **AC-1.5.7** Local QA path ยังใช้งานได้ (documented): ใช้ fixture หรือ env flag

### 5.4 ความเสี่ยง
- Marketing ยังไม่มี data path ใน D1 → 5.5a อาจทำให้ marketing page ว่างบน staging จนกว่าจะมี API (ยอมรับได้ชั่วคราว ถ้า error สื่อสารชัดเจน)
- KAI heatmap tool หยุดให้ผลชั่วคราว (fail-closed) — ดีกว่าตอบตัวเลขเก่าที่ drift

---

## 6. Cross-cutting — Verification Gate ทุกงาน

สำหรับทุกงาน 1.1–1.5 ต้องผ่าน:
1. `npx tsc --noEmit` — 0 errors
2. `npm run lint` — 0 errors
3. `npm test` — build + suite ใน script (41 ไฟล์จาก 50 ไฟล์ใน `tests/`; อีก 9 ไฟล์ commission/KAI-phase2b ยังไม่อยู่ใน suite) เขียว
4. ตรวจ regression tests ที่อ่าน source เป็น text (style ของ repo) — เปลี่ยนโค้ดทุกครั้งต้อง scan: `booking-regression`, `dashboard-source-safety`, `localization-regression`, `kai-header-regression`, `multi-company-isolation`, `live-dashboard-completion`, `sales-live-integration`
5. Staging verify ก่อน prod (โดยเฉพาะ 1.2, 1.4, 1.5a)

**Deploy batching แนะนำ**
- Deploy 1: 1.1 + 1.4 + 1.3 (โค้ด/เนื้อหา — staging → prod)
- Deploy 2: 1.2 (migration กับ OPERATIONS_DB staging → prod หลัง topology decision) + 1.5a
- Deploy 3: 1.5b + 1.5c (หลัง QA sign-off ว่าไม่มีใครพึ่ง JSON)

## 7. Out of scope (งานนี้) / Dependency ไป Phase 2
- E2 taxonomy + E3 targets → UI — ไม่ถูกบล็อกโดย 1.1–1.5 (ทำคู่ได้; 1.5.5a ของ marketing aggregate ควรคอย E2)
- A1/F1 reconcile migration — **1.2 และ 1.5 ต้องบันทึก decision ที่เกี่ยวข้อง** (lineage mirror, data home) แต่การ reconcile เองเป็นงาน Phase 2
- CSP enforcement (ระยะ 2 ของ 1.4) — หลัง review report บน staging
- Marketing D1 table + import + API — งาน Phase 2 ที่ 1.5 เปิดค้างไว้
