# Agriculture Overview — Executive Intelligence Dashboard (ภาพรวมข้อมูลเกษตร)

**Status:** READY_FOR_LOCAL_REVIEW — หยุดที่ Local Review ตามข้อกำหนด ไม่ commit / ไม่ push / ไม่ deploy

---

## FILES_CHANGED

### ใหม่ (7 ไฟล์ใน `src/modules/agriculture/`)

| ไฟล์ | บทบาท |
|---|---|
| `agriculture.overview-view.ts` | **Pure derivation module (React-free)** — summary KPIs, township map points (พร้อม canonical bridge → polygon map), ranking, crop mix (scope + per-township), quality 6 metrics, scope breadcrumb |
| `AgricultureKPICards.tsx` | 4 Executive KPI cards (crops / area+qualifier / township coverage / confidence + progress bar) |
| `AgricultureIntelligenceMap.tsx` | **Agriculture Intelligence Map** — `GlobalVectorMap` (MapLibre เดิมที่ reuse) + layer toggle 4 แบบ: crop density (choropleth) / main crop / sales opportunity / weather risk + legend + click → select |
| `AreaIntelligencePanel.tsx` | Selected-area panel: top-3 crop mix bars, planting window, weather snapshot, opportunity badge |
| `AgricultureInsightCard.tsx` | AI insight derive จากข้อมูลจริงเท่านั้น (top area + main crop + planting window) — ไม่มี recommendation สมมติ |
| `TopAgricultureRanking.tsx` | Top-5 cultivation area table (rank/township/main crop/area/confidence) |
| `AgricultureQualityPanel.tsx` | 6 quality metrics (presence/area/yield/calendar/weather/verification) + progress bars + gaps link |

### แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `AgricultureOverview.tsx` | **เขียนใหม่ทั้งหน้า** เป็น orchestrator — breadcrumb + KPI + map/panel + insight/ranking/quality; เก็บ `eligiblePresenceKeys` computation (ใช้แสดง badge การพบพืชที่ยืนยัน) ตามที่ test เดิม assert |
| `agriculture.ui.ts` | เพิ่ม copy section `overviewIntelligence` (~75 keys, th/en) |
| `tests/agriculture-overview-view.test.mjs` | **ใหม่ 10 tests** (จาก real fixtures D1) |
| `package.json` | ลงทะเบียน test ใน `npm test` |

**ไม่มีการแก้:** API route, service (business layer), schema/migration, Weather module, Agriculture Data page, Crop Calendar, Sales Opportunity, KAI, globals.css

---

## UI_STRUCTURE_BEFORE → AFTER

- **เดิม:** KPI 5 ใบ + WeatherMap (ตำแหน่งอย่างเดียว) + current-crop card + coverage stats grid + 3 cards (weather snapshot/calendar preview/KAI paused) — report-style, map ไม่ได้เป็นจุดหลัก
- **ใหม่:** Breadcrumb ขอบเขต + badge การพบพืช → KPI 4 ใบ → **Intelligence Map (จุดหลัก, layer toggle, click → select)** + selected-area panel ขวา → insight/ranking/quality 3 columns → footer note

## DATA_LOGIC_CHANGED = NO · NEW_DATA_CREATED = NO · BUSINESS_RULES_CHANGED = NO
ทุกค่า derive จาก payload จริงผ่าน pure functions — ไม่มี mock data, ไม่มี insight ที่ไม่มีข้อมูลรองรับ

---

## TEST_RESULTS

| Test | ผล |
|---|---|
| `tests/agriculture-overview-view.test.mjs` (ใหม่ 10) | ✅ 10/10 — KPIs, canonical bridge (Nattalin → `mmr-bago-west-nattalin`, Tharrawaddy → null เพราะไม่อยู่ใน master), ranking (ACTUAL only, MORE_THAN preserved), crop mix per-scope/per-township, hazard historical, quality tones, breadcrumb, no-fabrication guard |
| `tests/agriculture-phase1.test.mjs` (เดิม) | ✅ ผ่าน (assert `eligiblePresenceKeys` + ไม่มี "Machine Opportunities" ยังคงอยู่) |
| `tests/agriculture-data-view.test.mjs`, `agriculture-calendar-ui.test.mjs` | ✅ ผ่าน |
| `tests/locale-parity.test.mjs` | ✅ ผ่าน |
| `npm test` (build + suite เต็ม) | ✅ **377/377 pass** (+10) |

## TYPECHECK_RESULT
`npx tsc --noEmit` → ✅ **0 errors**

## LINT_RESULT
`npx eslint` (ทุกไฟล์ที่แก้) → ✅ **0 errors, 0 warnings**

## BUILD_RESULT
`npm test` (รวม `npm run build`) → ✅ ผ่าน

## RESPONSIVE_RESULT
- Code-review ผ่าน: KPI `sm:grid-cols-2 xl:grid-cols-4`, map/panel `xl:grid-cols-[1.6fr_0.9fr]`, bottom `xl:grid-cols-3`, map container `min-h-[420px]` responsive, panel weather grid `grid-cols-3`, table `overflow-x-auto`
- ⚠️ ยังไม่ได้ UAT หน้าจริง (ต้อง login + harness) — รอ Local Review

## LOCALIZATION_RESULT
- th/en ครบทุกสตริงใหม่ผ่าน `agricultureCopy(overviewIntelligence)` — ไม่มี hardcode
- MM: fallback เป็นอังกฤษผ่าน pattern เดิมของโมดูล

---

## KNOWN_LIMITATIONS

1. **Opportunity layer (Layer 3)**: D1 มี `opportunities = 0` → แสดง empty state ที่ซื่อสัตย์ ("ยังไม่มีข้อมูลโอกาสทางการขาย") ไม่ได้สร้าง marker ปลอมตาม mockup
2. **Weather risk layer (Layer 4)**: `weatherState = 0` → แสดงเฉพาะ **historical hazards** (FLOOD ที่ Hpa-An/Kawkareik) พร้อมป้าย "ข้อมูลย้อนหลัง" — ไม่แสดงเป็นความเสี่ยงปัจจุบัน
3. **Tharrawaddy** ไม่มีใน `data/master-townships.json` → canonicalId = null → polygon เป็น no-data (honest; ต้องเพิ่มใน master ก่อน map จะไฮไลต์ได้)
4. **Nattalin rice 110,262 acres = PLAN** → density ใช้ ACTUAL เท่านั้น (7,532 acres) → ในการ์ด/ranking เป็น "ปานกลาง" ไม่ใช่ "ปลูกมาก" ตาม mockup (mockup ใช้ตัวเลข PLAN ผิดเป็น ACTUAL)
5. **KPI area card** ใช้ `kpis.cultivatedArea` (82,532 acres, MORE_THAN) ตาม contract เดิม — ครอบทั้ง scope (รวม Mudon 75,000)
6. **Insight card** จำกัดเฉพาะข้อมูลจริง: top area + main crop + planting window — ไม่มี "แนะนำ Tractor campaign 45 วัน" แบบ mockup เพราะไม่มีข้อมูลรองรับ (ต้องมี machine population / booking / territory จริง)

## OPEN_DATA_GAPS (รอข้อมูลจริง)

- Field verification = 0/9, yield = 0/9 → quality panel แสดง "ขาด" ตามจริง
- weatherState / opportunities ยังว่างใน D1 → layers แสดง empty states
- ปฏิทินมีเฉพาะ SOWING (Nattalin) และบาง record → planting window แสดงเฉพาะที่มีข้อมูล

## READY_FOR_LOCAL_REVIEW = YES

---

## NEXT STEP (แนะนำ)

1. เปิดหน้า "ภาพรวมข้อมูลเกษตร" ใน local env → ตรวจ KPI/map/layer toggle/panel/ranking จริง
2. ทำ visual UAT harness (render component จริงด้วย fixture จริงที่ 1024/768/390/375) เหมือนรอบ crop calendar ก่อนประกาศเสร็จ
3. เมื่อ QA ผ่าน → รอ approval ก่อน commit
