# KMM Agriculture → Crop Calendar Redesign — Final Report

**วันที่:** 15 ส.ค. 2026 · **ขอบเขต:** UI/UX + presentation layer เท่านั้น (ตาม task)

---

## FILES_CHANGED

| ไฟล์ | ลักษณะการเปลี่ยน |
|---|---|
| `src/modules/agriculture/agriculture.calendar-view.ts` | **ใหม่** — pure derivation module (React-free) สำหรับ presentation layer ทั้งหมด: กลุ่ม timeline, สถานะรายเดือน, evidence badge, donut, breadcrumb, sources, CSV |
| `src/modules/agriculture/AgricultureCalendar.tsx` | **เขียนใหม่ทั้งหมด** — หน้า Crop Calendar ใหม่ 4 ระดับ (scope → situation cards → 12-month Gantt → analytics) + detail drawer |
| `src/modules/agriculture/agriculture.ui.ts` | เพิ่ม section copy `calendarView` (th/en) ตาม pattern `localizedText` เดิมของโมดูล |
| `src/modules/agriculture/WeatherAgriculturePage.tsx` | ส่ง optional props `onOpenAgricultureData` (สลับ tab ไปข้อมูลเกษตร) + `onResetFilters` (รีเซ็ตตัวกรอง) ให้หน้า calendar |
| `tests/agriculture-calendar-ui.test.mjs` | **ใหม่** — 13 regression tests (timeline mapping, current-month marker, evidence level, no-data, historical vs current, donut, breadcrumb, CSV, no-fabrication guard) |
| `package.json` | ลงทะเบียน `tests/agriculture-calendar-ui.test.mjs` ใน `npm test` |

ไม่มีการแก้: API route, service (business layer), schema/migration, Weather module, KAI, Sales, Booking, Stock, Targets, Auth/Permission, worker, globals.css

---

## UI_STRUCTURE_BEFORE

- หัวข้อการ์ดอธิบายยาว + badge "มีแหล่งข้อมูลรองรับ"
- ตาราง timeline 1 แถวต่อ **1 calendar record** → บาง crops โผล่หลายแถว (ฤดู/ระยะแยกกัน) มี 4 บรรทัดข้อความต่อแถว (location · stage · season, source · geography · verification · confidence, duration, notes)
- แถบสีเป็นก้อนข้อความเต็มเดือน ("ข้อมูลอ้างอิงระดับภูมิภาค · ช่วงเก็บเกี่ยว: ต.ค.–ธ.ค.") — อ่านยาก
- ไม่มี current-month marker, ไม่มีสถานการณ์รายเดือน, ไม่มี drawer, ไม่มี donut/พื้นที่, sources กระจัดกระจายในข้อความต่อแถว
- Coverage card 6 ค่า (ตัวเลขสถิติของ D1) ไม่ได้ช่วยตอบคำถามผู้บริหาร

## UI_STRUCTURE_AFTER

1. **Header + breadcrumb "ขอบเขตการวางแผน"** — `Myanmar > Bago Region > Nattalin Township > 2026/27` (เชฟรอน) + chip ระดับข้อมูลจริง (Township / รัฐ-ภูมิภาค / ระดับภูมิภาค / ระดับประเทศ / หลายระดับ) + ปุ่ม เกี่ยวกับข้อมูล / ดาวน์โหลด CSV / รีเซ็ตตัวกรอง
2. **สถานการณ์เดือนนี้** — 4–6 cards ต่อ scope (crop + season + badge ระยะอ้างอิง + "อีก X เดือนถึงช่วงเก็บเกี่ยว" + ช่วงโดยทั่วไป + evidence) — badge ทุกตัว derive จาก window จริงเท่านั้น
3. **ปฏิทินเพาะปลูก 12 เดือน** — Gantt grid `180px + 12×64px`: แถว = crop+season, แถบสีตาม 6 หมวด (เตรียมพื้นที่/เริ่มต้นปลูก/เจริญเติบโต/ใกล้เก็บเกี่ยว/เก็บเกี่ยว/กรีด) + เส้นประแนวตั้ง "เดือนปัจจุบัน" (พาไปกับ scroll) + legend + toggle "แสดงเฉพาะพืชหลัก" + ส่งออก CSV + การ์ดรายการผลักย้อนหลัง/สืบทอด
4. **Detail drawer** — ใช้ `.kmm-kai-panel` เดิม (desktop ขวา / mobile bottom sheet): ช่วงการเพาะปลูกทุกระยะ, duration, source + ปี, evidence, verification, confidence, yield (แสดง "ไม่มีข้อมูลผลผลิตในระดับนี้" เมื่อไม่มี — ไม่ประมาณ) + ปุ่ม "ดูรายละเอียดเชิงลึก" → tab ข้อมูลเกษตร
5. **Analytics ล่าง 3 cards** — donut พื้นที่ (เฉพาะ ACTUAL township / CSO sown area ระดับรัฐ), ตารางพื้นที่ที่เกี่ยวข้อง (Township/Crop/Window/Verification), แหล่งข้อมูลรวม (ปี/ภูมิศาสตร์/verification/จำนวนรายการที่อ้างอิง)
6. **Footer note** — "ข้อมูลนี้เป็นปฏิทินอ้างอิงตามสภาพภูมิภาค ยังไม่ใช่สถานะปัจจุบันจากพื้นที่ (KMM Verification)" + หลักการ "ไม่มีข้อมูล ≠ ข้อมูลผิด"

---

## DATA_LOGIC_CHANGED = NO
## NEW_DATA_CREATED = NO
## BUSINESS_RULES_CHANGED = NO

- ทุกค่าใน UI derive จาก `AgricultureOverviewPayload` เดิมผ่าน `agriculture.calendar-view.ts` (pure functions) เท่านั้น
- ไม่มี DB write, ไม่มี API change, ไม่มี migration, ไม่มี data model ใหม่
- กติกาเดิมถูกเคารพ: donut ใช้เฉพาะ ACTUAL township (ไม่รวม PLAN/TARGET — ตรงกับ KPI logic), state area ใช้ CSO 9.12 เท่านั้น, ไม่มี yield ระดับพื้นที่เพราะไม่มี source รองรับ, ไม่มี "กำลังปลูก/กำลังเจริญเติบโต" เมื่อไม่มี current field verification

## TEST_RESULTS

| Test | ผล |
|---|---|
| `tests/agriculture-calendar-ui.test.mjs` (ใหม่ 13) | ✅ 13/13 |
| `tests/agriculture-phase1.test.mjs` (เดิม) | ✅ ผ่าน (ข้อมูล D1 ไม่ถูกแตะ) |
| `tests/weather-regression.test.mjs` (เดิม) | ✅ ผ่าน |
| `npm test` (build + suite เต็ม 43 ไฟล์) | ✅ **356/356 pass** |

## TYPECHECK_RESULT
`npx tsc --noEmit` → ✅ **0 errors**

## LINT_RESULT
`npm run lint` → ✅ **0 errors** (72 warnings = baseline เดิมของ repo ไม่มีใหม่จากงานนี้)

## BUILD_RESULT
`npm run build` (ใน `npm test`) → ✅ **ผ่าน**

## RESPONSIVE_RESULT
- Desktop → grid 5/3/2 columns สำหรับ situation cards; timeline scroll แนวนอน min-width 948px (เหมือนตารางอื่นในแอป)
- Mobile/tablet → cards เป็น horizontal snap scroll; drawer เป็น bottom sheet 80dvh (ผ่าน `.kmm-kai-panel` ที่มีอยู่)
- **ยังไม่ได้ UAT จริงที่ 375px** (ต้อง login + company context จึงจะเห็นหน้า) — ตรวจผ่าน code review + layout tokens เท่านั้น

## LOCALIZATION_RESULT
- ทุกสตริงใหม่เป็นคู่ th/en ผ่าน `agricultureCopy().calendarView` — ไม่มี hardcode ภาษาไทยหลุดในโหมด en (guard ใน test)
- **Myanmar:** โมดูล agriculture ทั้งโมดูลรองรับ th/en เท่านั้น (pattern `localizedText` เดิม) — MM fallback เป็นอังกฤษ เหมือนพฤติกรรมเดิมของโมดูล ไม่ใช่ regression; การแปลพม่าเต็มโมดูลเป็นงานแยกที่ต้องมีเจ้าของภาษา (สอดคล้องกับ TODO(my) ในงาน my.ts เดิม)
- Gregorian year บังคับใน `Intl.DateTimeFormat` (กัน Buddhist Era 2569 หลุดในภาษาไทย)

## KNOWN_LIMITATIONS
1. **ข้อมูลจริงมีจำกัด** — Bago Region มี calendar แค่ ข้าว (2 ฤดู) + ยางพารา; "สถานการณ์เดือนนี้" จึงแสดง 3 cards สำหรับ scope นั้น (mockup มี 5) — UI แสดงตามจริง ไม่มีแถบ/การ์ดที่ข้อมูลไม่มี
2. **"ช่วงกลางฤดู" (betweenWindows)** เป็นการ derive เชิงตรรกะจาก window จริง (หลัง planting หน้าหน้าต่างก่อน harvest) ไม่ใช่ข้อมูล agronomic ใหม่ — badge แสดงคำว่า "ช่วงกลางฤดู (อ้างอิง)" เสมอ ไม่ใช่ "กำลังเจริญเติบโต"
3. current-month marker ใช้ company timeZone (จาก `selectedCompany.timeZone`) แบบ client-side — ไม่ได้ผ่าน API asOf เหมือน E1 booking age (งานนี้เป็น presentation-only จึงไม่แตะ API; ถ้าต้องการความสอดคล้องเต็มรูปแบบ ต่อยอดได้)
4. "แสดงเฉพาะพืชหลัก" อิง `importanceLevel === MAJOR` ใน presence — Bago scope ยังไม่มี → toggle ถูก disable พร้อม note (ตรงกับข้อมูลจริง)
5. พื้นที่ที่เกี่ยวข้อง (Card B) เต็มเฉพาะ scope Township/ALL — scope รัฐเดียวแสดง empty state พร้อม hint

## OPEN_DATA_GAPS
- ไม่มี `CURRENT_OBSERVED` calendar rows, ไม่มี `agri_calendar_estimates`, ไม่มี field verification ใน D1 ท้องถิ่น → ทุก badge เป็น "ข้อมูลอ้างอิง" ไม่ใช่ "สถานะปัจจุบัน" (UI รองรับ full path ไว้แล้ว — เมื่อมีข้อมูล verified จะแสดง badge "ระยะยืนยันจากพื้นที่" โดยอัตโนมัติ)
- Bago/รัฐอื่นยังไม่มี presence/cultivated area ระดับ township ครบ → donut ระดับรัฐใช้ CSO sown area 9.12 (V4)
- ไม่มี yield ระดับพื้นที่ (มีแต่ Union-level 9.15 ซึ่ง UI ไม่นำมาแสดงเป็นค่า local)

## READY_FOR_LOCAL_REVIEW = YES

**หมายเหตุ:** ไม่ commit / ไม่ push / ไม่ deploy — ไฟล์ทิ้งไว้ uncommitted ใน working tree (agriculture module ทั้งโมดูลเป็นงาน pre-existing ที่ยังไม่ commit อยู่แล้ว)
