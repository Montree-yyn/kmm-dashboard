# F4 — Enterprise Loading Architecture

**Status:** DONE — implemented, build + full suite green. **ไม่ commit / ไม่ deploy** รอ review

**Scope:** Performance UX only — ไม่แตะ business logic, API contract, data model

---

## 1. AUDIT SUMMARY (ก่อนแก้)

| เรื่อง | ก่อน (พบ) |
|---|---|
| Route-level loading | **ไม่มี** `loading.tsx` ใน route ใดเลย — navigation ไปหน้าใหญ่ = blank จนกว่า chunk โหลดเสร็จ |
| Route-level error | **ไม่มี** `error.tsx` / ErrorBoundary — runtime crash = blank page ทั้งแอป |
| KAI widget | `KaiHeaderAssistant` **static import** ใน global-header → bundle KAI (chat UI + icons + Workers AI client) โหลดทุกหน้าทุกครั้ง |
| Marketing map | `MyanmarMarketingMap` static import → map module graph (MapLibre/PMTiles/Protomaps basemap) ผูกเข้า marketing chunk |
| Agriculture map | `GlobalVectorMap` static import ใน AgricultureIntelligenceMap |
| Firebase | `lib/firebase.ts` import `getStorage` → **Firebase Storage SDK อยู่ใน main bundle** ทั้งที่ใช้เฉพาะ Company Management |
| Skeletons in-content | dashboard/sales/booking/stock/marketing มี `LoadingSkeleton` อยู่แล้ว; agriculture มี `LoadingState` — ครอบ phase fetch data แล้ว |

## 2. CHANGES

### Route-level loading.tsx (11 routes)
`app/{dashboard,sales,booking,stock,marketing,weather,data-hub,team,settings,expense,daily-management}/loading.tsx`
- Shared `components/design-system/route-loading.tsx`: page-shell skeleton (title bar + 4 KPI cards + 3 chart blocks + table block) ใช้ token เดิม (`kmm-surface`, `--radius-card`, `--surface-muted`), `role="status"` + `aria-busy` ตาม convention ของ `LoadingSkeleton`
- แสดงทันทีระหว่าง download chunk / client-side navigation — แทน blank

### Route-level error.tsx (11 routes)
`app/{...}/error.tsx` → shared `components/design-system/route-error-boundary.tsx` ("use client")
- Catch error ใน page subtree → shell/sidebar/header ยัง alive, มีปุ่ม Try again (reset) + error digest reference

### Lazy load (React.lazy + Suspense — shell mount หลัง auth เท่านั้น จึงไม่มี hydration mismatch)
| Component | ผล |
|---|---|
| `KaiHeaderAssistant` (global-header) | chunk แยก 21.5 KB — โหลดเฉพาะเมื่อใช้; fallback = pill "KAI" ขนาดเท่าเดิม (กัน layout shift) |
| `MyanmarMarketingMap` (marketing page) | chunk แยก 36.7 KB — โหลดเมื่อ map view mount; fallback = LoadingSkeleton |
| `GlobalVectorMap` (AgricultureIntelligenceMap) | chunk แยก — โหลดเมื่อ map section mount; fallback = LoadingSkeleton |
| Firebase Storage | แยก `lib/firebase-storage.ts` — `lib/firebase.ts` เหลือ auth/app เท่านั้น; `company-management/client.ts` import จากไฟล์ใหม่ → storage chunk 3.4 KB ไม่อยู่ใน main |

> Maps: maplibre-gl (1,003 KB) ถูก dynamic import ภายใน `GlobalVectorMap` อยู่แล้ว (ไม่เข้า main chunk); การ wrap React.lazy อีกชั้น ทำให้ component module graph (pmtiles protocol, Protomaps basemap) ไม่โหลดบนหน้าไม่มีแผนที่
> Charts: SVG ล้วนเล็กอยู่แล้ว (ไม่ external lib) — ไม่ต้อง lazy; `xlsx` (355 KB) เป็น dynamic import อยู่แล้วใน data-hub/daily-management import paths — **ไม่แตะ** เพราะเป็นการแก้ parse utility (business path)

## 3. BEFORE / AFTER LOADING BEHAVIOR

| Moment | Before | After |
|---|---|---|
| Navigate → หน้าใหญ่ (dashboard/sales/…) | blank จน chunk + data โหลดเสร็จ | skeleton shell ทันที (route loading.tsx) → in-content skeleton (เดิม) → data |
| Navigate → marketing | หน้า blank + map module ถูก main chunk ดึงมารวม | skeleton → marketing UI → map โหลดแยกเมื่อ mount |
| หน้าใดก็ได้ (ทุกหน้า) | KAI bundle ถูกโหลดเสมอ | KAI chunk โหลดเฉพาะเมื่อ shell mount (ครั้งเดียวต่อ session) |
| เปิด settings > company management | storage SDK อยู่ใน main bundle แล้ว | storage chunk 3.4 KB โหลดเฉพาะหน้า company management |
| Runtime error ในหน้า | blank page ทั้งแอป | error boundary แสดง UI + ปุ่ม Try again, shell ยังทำงาน |

**Chunk evidence (build ใหม่):**
```
kai-header-assistant      21.5 KB  (แยก)
myanmar-marketing-map     36.7 KB  (แยก)
input-storage              3.4 KB  (แยกจาก firebase main)
maplibre-gl            1,003.5 KB  (lazy อยู่แล้ว — ไม่เข้า main)
global-app-shell          24.9 KB  (main shell — KAI/map/storage ไม่ปน)
```

## 4. FILES CHANGED

**ใหม่ (29):**
- `components/design-system/route-loading.tsx`, `components/design-system/route-error-boundary.tsx`
- `lib/firebase-storage.ts`
- `app/{dashboard,sales,booking,stock,marketing,weather,data-hub,team,settings,expense,daily-management}/{loading,error}.tsx` (22 files)

**แก้ (4):**
- `components/layout/global-header.tsx` — KAI → React.lazy + Suspense
- `components/marketing/marketing-intelligence-page.tsx` — MyanmarMarketingMap → React.lazy + Suspense
- `src/modules/agriculture/AgricultureIntelligenceMap.tsx` — GlobalVectorMap → React.lazy + Suspense
- `lib/firebase.ts` (ตัด storage) + `lib/company-management/client.ts` (import จาก firebase-storage)

**ไม่แตะ:** business logic / API contract / schema / page components (dashboard-page etc.) / design tokens

## 5. TEST RESULTS

| Gate | ผล |
|---|---|
| `npm run build` (vinext + Cloudflare Worker) | ✅ ผ่าน — manifest มี `dashboard/loading.tsx` + error routes; chunks แยกถูกต้อง |
| `npx tsc --noEmit` | ✅ 0 errors |
| ESLint (ไฟล์ที่แก้/ใหม่ทั้งหมด) | ✅ 0 errors 0 warnings (marketing page มี warnings เดิม 34 รายการ — ไม่ได้เพิ่ม) |
| `npm test` (full suite) | ✅ **379/379 pass** — รวม rendered-html (SSR shell), kai-header-regression, map-foundation, marketing-regression, settings/expense/global-navigation (assert `<KaiHeaderAssistant` ยัง intact) |

## 6. KNOWN NOTES / DEFERRED

- **@e965/xlsx (355 KB)** — ถูก dynamic import แล้วใน parse paths; งานย้ายไป lazy-at-click ใน UI ต้องแตะ `lib/data-hub/parse-spreadsheet.ts` (async → sync signature) ซึ่งเป็น business path → **defer**
- loading.tsx แสดงช่วง navigation; initial load ยังถูก auth-gate (spinner เดิม) ครอบก่อน shell — ตาม design เดิม
- ยังไม่มี route-level `loading.tsx` ที่ `/` (HomeRedirect) และ `/login` — เป็น thin redirect/auth page ไม่ต้องใช้
- Error UI เป็น copy ภาษาอังกฤษคงที่ (ไม่เพิ่ม locale keys → ไม่กระทบ locale-parity test)

**READY_FOR_REVIEW = YES**
