# F5 — Enterprise Request Deduplication

**Status:** DONE — build + full suite green. **ไม่ commit / ไม่ deploy** รอ review

**Scope:** Performance only — ไม่แตะ business logic, DB schema, API contract, UI design, loading/error behavior ของหน้า

---

## 1. AUDIT — duplicate fetches ที่พบ

| Dataset | Fetched by | ปัญหาก่อนแก้ |
|---|---|---|
| `/api/sales` | Dashboard, Sales, Team (ทุก mount ใหม่) | 1 journey ผ่าน 3 หน้า = **sales fetch 3 ครั้ง** (payload ~2.2 MB ต่อครั้ง) |
| `/api/operations` | Dashboard, Booking, Stock, Team | 1 journey = **operations fetch 4 ครั้ง** (~0.9 MB ต่อครั้ง) |
| `/api/weather` + `/api/weather/radar` | Weather page | mount → 2 requests; re-mount ซ้ำ (ไม่มี cache) |
| `/api/agriculture/*` (overview + 10 GETs) | WeatherAgriculturePage | mount → ~11 requests; StrictMode double-effect → ซ้ำ |
| `/api/company-context` | CompanyProvider (singleton) | ✅ เดิม dedup แล้ว (provider เดียว) |
| Firebase auth | `onAuthStateChanged` (singleton) | ✅ เดิม dedup แล้ว |

**Symptom:** navigation ระหว่างหน้า = re-fetch เต็มชุด + no `cache` ระหว่าง mount + ไม่มี in-flight dedupe (React StrictMode / concurrent mount → double fetch)

## 2. SHARED CLIENT DATA LAYER — `lib/client-data-layer.ts` (ใหม่)

Singleton `clientDataLayer` + class `ClientDataLayer` (testable):
- **In-flight dedupe** — caller หลายรายสำหรับ key เดียว ใช้ promise เดียวกัน (ครอบ StrictMode double-effect / concurrent mount)
- **TTL cache (default 30s)** — กลับไป-มาระหว่างหน้าที่อ่านชุดข้อมูลเดียวกัน → reuse payload
- **`force: true`** — bypass cache สำหรับ explicit refresh (weather ใช้ `forceRefresh` เดิม)
- **Error ไม่ cache** — retry refetch เสมอ (ErrorState เดิมของหน้าไม่เปลี่ยน)
- **Cache invalidation:**
  - `kmm:sales-imported` (Data Hub re-import) → invalidate `sales:` + `operations:`
  - `kmm:company-changed` (switch company) → clear ทั้งหมด
  - agriculture mutation สำเร็จ → invalidate `agriculture:` (verification save → หน้าโหลดใหม่ได้ข้อมูลสด)

**Preserve contract:** signature ของ `loadLiveSalesData` / `loadLiveOperationalData` / `loadLiveWeather` / `loadWeatherRadar` / `loadAgriculture*` ไม่เปลี่ยน — เพิ่ม `force?` optional; payload shape, fallback semantics (`allowFallback`, `companyId && companyId !== COMPANY_ID`, `asOf`), loading/error flow ของทุกหน้าเหมือนเดิม

## 3. FILES CHANGED

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `lib/client-data-layer.ts` | **ใหม่** — shared dedup + TTL cache + invalidation |
| `lib/sales/client.ts` | `loadLiveSalesData` → layer (key `sales:{companyId}`) |
| `lib/operations/client.ts` | `loadLiveOperationalData` → layer (key `operations:{companyId}`) |
| `src/modules/weather/weather.client.ts` | `loadLiveWeather`/`loadWeatherRadar` → layer (`forceRefresh` → `force`) |
| `src/modules/agriculture/agriculture.client.ts` | GET ทั้งหมด → layer (key รวม resource+company+params ไม่รวม `ts`); mutation → invalidate prefix |
| `tests/client-data-layer.test.mjs` | **ใหม่ 9 tests** (dedupe/TTL/expiry/force/error-no-cache/invalidate/clear/2 events) |
| `package.json` | register suite |

ไม่แตะ: pages, API routes, business logic, schema, marketing (F3 แยกงาน — ยังโหลด dashboard-data.json เอง)

## 4. BEFORE / AFTER NETWORK REQUESTS

**Journey เดียว** (Dashboard → Sales → Booking → Stock → Team → Weather ภายใน 30s):

| Dataset | Before | After | ลด |
|---|---|---|---|
| `/api/sales` | 3 (dashboard/sales/team) | **1** (dashboard; sales+team ใช้ cache) | −67% |
| `/api/operations` | 4 (dashboard/booking/stock/team) | **1** | −75% |
| `/api/weather` + radar | 2 ต่อ mount | 1 ต่อ dataset ต่อ TTL | ~−50% |
| `/api/agriculture/*` | ~11 ต่อ mount (StrictMode ซ้ำได้) | 1 ต่อ resource ต่อ TTL | ~−50% |

**Payload saving estimate:** sales 2.2 MB + operations 0.9 MB ต่อ journey → หลัง dedupe เหลือ **~3.1 MB → ~1.6 MB** บน wire (เฉพาะ layer นี้; F1/F3 จะลด payload ต่อ request เองอีกชั้น)

**Reactivity ยังครบ:** import ข้อมูลใหม่ (kmm:sales-imported) → invalidate → หน้า refetch ทันที; switch company → clear ทุก key

## 5. TEST RESULTS

| Gate | ผล |
|---|---|
| `node --test tests/client-data-layer.test.mjs` | ✅ 9/9 (dedupe/TTL/expiry/force/error/invalidate/clear/events) |
| `npx tsc --noEmit` | ✅ 0 errors |
| ESLint (ไฟล์ที่แก้/ใหม่) | ✅ 0 problems |
| `npm test` (full suite + build) | ✅ **388/388 pass** (+9) — dashboard-source-safety, multi-company-isolation, booking-age, sales-live-integration, weather, agriculture ทั้ง intact |

## 6. KNOWN NOTES / DEFERRED

- Marketing ยัง fetch `dashboard-data.json` ตรง (ไม่ผ่าน layer) — เป็นงาน F3 (ย้ายไป API/D1 + pmtiles); dedupe จะได้อัตโนมัติเมื่อย้าย
- TTL 30s เป็นค่าเริ่มต้น — หน้าต้องการ freshness สูงกว่านี้ส่ง `ttlMs` หรือ `force: true` ต่อ request
- Layer เป็น client-side เท่านั้น — ไม่แตะ worker/API ฝั่ง server

**READY_FOR_REVIEW = YES**
