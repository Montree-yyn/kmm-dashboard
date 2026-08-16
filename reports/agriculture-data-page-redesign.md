# Agriculture Data Page — Enterprise UX Redesign (ข้อมูลเกษตร)

**Status:** READY_FOR_LOCAL_REVIEW — หยุดที่ Local Review ตามข้อกำหนด ไม่ commit / ไม่ push / ไม่ deploy

---

## FILES_CHANGED

### ใหม่ (7 ไฟล์ใน `src/modules/agriculture/`)

| ไฟล์ | บทบาท |
|---|---|
| `agriculture.data-view.ts` | **Pure derivation module (React-free)** — KPI summary, crop cards, donut, township ranking, trend, quality metrics, source groups, detail rows, scope breadcrumb — derive จาก payload จริงเท่านั้น |
| `agriculture.data-charts.tsx` | Chart primitives (DonutChart conic-gradient, RankingBars, TrendLineChart SVG, ChartCard, DataEmptyState) + `formatNumber`/`formatCropYear` |
| `AgricultureSummaryCards.tsx` | 4 Executive KPI cards (crops/sources, area+year, townships, confidence+progress bar) |
| `CropOverviewCards.tsx` | Card layout แทน table (click → drawer, badge ข้อมูลจริง/เป้าหมาย/แผน, ระดับข้อมูล) |
| `AgricultureAnalytics.tsx` | 3 charts: donut crop distribution / township ranking bars / rice area trend line |
| `DataQualityPanel.tsx` | 5 quality metrics (presence/area/yield/calendar/verification) + gaps alert |
| `SourceSummary.tsx` | Source grouping summary (expandable) |
| `AgricultureDetailTable.tsx` | Detail table ด้านล่าง (search/sort/filter + แสดง 5 ล่าสุด + expand) |
| `AgricultureDataPage.tsx` | หน้าใหม่รวมทั้งหมด + scope breadcrumb + metric explain + crop detail drawer |

### แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `agriculture.ui.ts` | เพิ่ม copy section `dataView` (~70 keys, th/en) + `townshipUnit`, `mainCrop` |
| `WeatherAgriculturePage.tsx` | เขียนใหม่ — เปลี่ยน `AgricultureDataView` (table เดิม) → `AgricultureDataPage`; ลบ dead helpers `getOfficialUnionYieldRows`/`formatYieldHeader`/`officialUnionYield` table UI; เก็บ filter bar/tabs/loading/error เดิมไว้ |
| `tests/agriculture-data-view.test.mjs` | **ใหม่ 11 tests** (จาก real fixtures D1) |
| `package.json` | ลงทะเบียน test ใน `npm test` |

**ไม่มีการแก้:** API route, service (business layer), schema/migration, Weather module, Crop Calendar, Sales Opportunity, KAI, globals.css, locales (th/en ผ่าน copy pattern เดิม)

---

## UI_STRUCTURE_BEFORE

หน้า "ข้อมูลเกษตร" เดิม = `AgricultureDataView` (inline ใน WeatherAgriculturePage) — **table-first**: header ตาราง + แถวข้อมูลยาว (area/year/source/confidence), ตัวเลขพื้นที่ก้อนเดียว, ไม่มีภาพรวม, ไม่มี card, ไม่มี drawer, ผู้ใช้ต้อง scroll ผ่านตารางเพื่อหาข้อมูล

## UI_STRUCTURE_AFTER

```
1. Header + Breadcrumb ขอบเขต        (Myanmar > Bago (West) > Nattalin > 2025/26) + ปุ่มอธิบายตัวชี้วัด
2. KPI Cards 4 ใบ                     (crops 5/28 sources · area 82,532 acres (MORE_THAN) · 2/9 townships · confidence 25%)
3. พืชสำคัญในพื้นที่                   (cards สแนป-scroll <lg / grid ≥lg, click → drawer)
4. Analytics 3 ชาร์ต                  (donut distribution · township ranking bars · rice trend line)
5. คุณภาพ + แหล่งข้อมูล                (5 metrics + gaps alert / source summary)
6. Detail table (รอง)                 (search/sort/filter, 5 ล่าสุด + expand)
7. Footer note (ข้อมูลอ้างอิงเท่านั้น)
```

**หลักความซื่อตรง (data honesty) ที่รักษา:**
- KPI area = ACTUAL township records หรือ state/region sown area (CSO 9.12) เท่านั้น — PLAN/TARGET ไม่รวมใน KPI แต่โชว์บนการ์ดพืชพร้อมป้ายประเภทข้อมูล (`ข้อมูลจริง`/`เป้าหมาย`/`แผน`/`ประมาณการ`)
- `MORE_THAN` qualifier แสดงเป็น `>` (82,532 เป็นค่าขั้นต่ำ)
- ไม่มี yield / fertilizer / machine recommendation ที่ไม่มี source
- ทุก badge มาจาก `recordType`/`presenceStatus` จริง — ไม่มีสถานะสมมติ
- Donut ใช้เฉพาะ ACTUAL (ไม่รวม TARGET 1,500 acres ของข้าวโพดใน mockup — นั่นคือเป้าหมาย ไม่ใช่พื้นที่จริง)

## DATA_LOGIC_CHANGED = NO
## NEW_DATA_CREATED = NO (ใช้ payload เดิมทั้งหมด ผ่าน pure functions)
## BUSINESS_RULES_CHANGED = NO

---

## TEST_RESULTS

| Test | ผล |
|---|---|
| `tests/agriculture-data-view.test.mjs` (ใหม่ 11) | ✅ 11/11 — summary KPIs, state vs township basis, crop cards (rice 110,262 acres = PLAN badge), donut sum≈100%, ranking, trend ascending, quality tones, sources sorted, detail rows, scope breadcrumb, no-fabrication guard |
| `tests/agriculture-phase1.test.mjs` (เดิม) | ✅ ผ่าน |
| `tests/agriculture-calendar-ui.test.mjs` (เดิม) | ✅ ผ่าน |
| `tests/weather-regression.test.mjs` (เดิม) | ✅ ผ่าน |
| `tests/locale-parity.test.mjs` (เดิม) | ✅ ผ่าน (key set th/en/my เท่ากัน) |
| `npm test` (build + suite เต็ม) | ✅ **367/367 pass** (+11) |

## TYPECHECK_RESULT
`npx tsc --noEmit` → ✅ **0 errors**

## LINT_RESULT
`npx eslint` (ไฟล์ที่แก้ทั้งหมด) → ✅ **0 errors, 0 warnings**

## BUILD_RESULT
`npm test` (รวม `npm run build`) → ✅ ผ่าน

## RESPONSIVE_RESULT
- Code-review ผ่าน: KPI grid `sm:grid-cols-2 xl:grid-cols-4`, crop cards `snap-x lg:grid xl:grid-cols-3 2xl:grid-cols-5`, analytics `xl:grid-cols-3`, quality/sources `lg:grid-cols-[3fr_2fr]`, detail table `overflow-x-auto min-w-[880px]`, drawer ใช้ `.kmm-kai-panel` (ขวาบน desktop / bottom-sheet บนมือถือ)
- ⚠️ ยังไม่ได้ UAT หน้าจริง (ต้อง login + harness ใหม่) — รอ Local Review เหมือนงาน crop calendar

## LOCALIZATION_RESULT
- th/en ครบทุกสตริงใหม่ผ่าน `agricultureCopy(dataView)` — ไม่มี hardcode (แก้ `แห่ง`/`พืชหลัก`/quality labels ให้ผ่าน copy ด้วย)
- MM: fallback เป็นอังกฤษผ่าน `agricultureCopy` pattern เดิมของโมดูล (การแปลพม่า = งานแยกเจ้าของภาษา)

---

## KNOWN_LIMITATIONS

1. **Trend chart**: ข้อมูล Nattalin มีแค่ 1 ปีของ ACTUAL (2024) → โชว์ empty state "มีข้อมูล 1 ปี" (honest) จนกว่าข้อมูลหลายปีจะเข้ามา; mockup แสดง 2019–2023 ซึ่งเป็นข้อมูล state/union ที่ API ยังไม่ให้ใน payload นี้
2. **Donut center** แสดงผลรวมของ eligible ACTUAL เท่านั้น — ถ้า scope มีเฉพาะ PLAN/TARGET donut จะเป็น empty state (ถูกต้องตามหลักการ)
3. **KPI crops card** นับ `activeCrops` จาก `kpis` (5) — จำนวนชนิดพืชที่พบจริงใน scope; card พืชแสดงเฉพาะ eligible local presence
4. **`viewAllCrops`/`viewAllSources`/`viewAllData`** ปัจจุบันเป็นตัวนับ (non-clickable) — รายการเต็มเข้าถึงได้ผ่าน expand ใน table/sources และ scroll cards

## OPEN_DATA_GAPS (ไม่ใช่บั๊ก — รอข้อมูลจริง)

- ไม่มี `CURRENT_OBSERVED`/field verification ใน D1 → verification 0/9, "การยืนยันจากพื้นที่ 0 รายการ" — UI แสดงตามจริง
- ไม่มี acreage แยกย่อยระดับ sub-township → ranking แสดงเฉพาะ township ที่มี ACTUAL
- Rice 2025 เป็น PLAN (110,262 acres) → badge "แผน" ไม่ใช่ "ข้อมูลจริง" แม้ตัวเลขจะใหญ่ — ถูกต้องตาม record type

## READY_FOR_LOCAL_REVIEW = YES

---

## NEXT STEP (แนะนำ)

1. เปิดหน้า "ข้อมูลเกษตร" ใน local env → ตรวจ KPI/cards/charts/drawer/table จริง
2. ต่อยอด: ทำ visual UAT harness แบบเดียวกับ crop calendar (render component จริงด้วย fixture จริงที่ 1024/768/390/375) ก่อนประกาศเสร็จ
3. เมื่อ QA ผ่าน → รอ approval ก่อน commit
