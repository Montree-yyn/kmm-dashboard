# F3 Phase 2 — Township Labels Dataset (ลด 11.4 MB จาก map overlay)

**Status:** DONE — build + full suite green. **ไม่ commit / ไม่ deploy** รอ review

**Scope:** ต่อจาก deferred item ของ F3 — performance only, ไม่แตะ business logic / KPI / map UX (label ตำแหน่งและลักษณะเหมือนเดิม 100%)

---

## 1. ปัญหา

`installLegacyPresentationOverlays` ใน `myanmar-marketing-map-maplibre.tsx` โหลด `/maps/myanmar-townships.geojson` (**11.4 MB**) ตอน map mount เพียงเพื่อคำนวณ label position ต่อ township (`getLabelPositions` = ค่าเฉลี่ยเลขคณิตของทุก vertex) + ตำแหน่ง badge เปรียบเทียบ — geometry เต็มประเทศถูกโหลดทั้งที่ใช้แค่ point ต่อพื้นที่

## 2. CHANGES

### ใหม่: `scripts/maps/build_township_labels.py`
- Replicate อัลกอริทึม `collectPoints` + vertex-mean ของ `getLabelPositions` แบบเป๊ะ (walk nested coordinates → เฉลี่ย lng/lat ทุก vertex ต่อ township)
- Output: `public/maps/myanmar-township-labels.json` — **31 KB** (จาก 11.4 MB, เล็กกว่า ~368×)

### แก้: `components/marketing/myanmar-marketing-map-maplibre.tsx`
- Fetch `/maps/myanmar-township-labels.json` แทน townships geojson (ใน `installLegacyPresentationOverlays`)
- `buildTownshipLabelCollection` + `comparisonLabelPositionsRef` + `townshipLabelsRef` ทำงานจาก labels โดยตรง (ไม่ต้อง `getLabelPositions` อีก)
- states geojson (4.5 MB) ยังคงอยู่ — จำเป็นสำหรับ state boundaries + state labels
- type `TownshipLabel = { name, stateRegion, coordinates }`

### แก้: `tests/map-foundation.test.mjs`
- อัปเดต assertion: maplibre อ้าง `myanmar-townships.geojson` → `myanmar-township-labels.json`
- **+1 test ใหม่**: labels dataset ต้องมี 330 entries, ไฟล์ <200 KB, และ coordinate ทุกรายการ = vertex-mean ที่คำนวณใหม่จาก geojson (0 mismatch)

### แก้: `package.json`
- เพิ่ม `maps:labels:mm` + ต่อท้าย `maps:pipeline:mm` (หลัง validate)

## 3. VERIFICATION

| ตรวจ | ผล |
|---|---|
| จำนวน labels | 330/330 (ตรง features ทั้งหมด) |
| ชื่อตรง master-townships | 0 missing |
| JS cross-check (replicate collectPoints+mean) | **0 mismatches** (330/330) |
| ไฟล์ใหม่ | 31 KB |
| Build chunk | maplibre overlay อ้าง `myanmar-township-labels.json` + `myanmar-states.geojson` + `kmm-showrooms.json`; 11.4 MB URL เหลือเฉพาะ legacy map fallback (ไม่โหลด runtime ปกติ) |

## 4. BEFORE / AFTER (map mount)

| ทรัพยากร | Before | After |
|---|---|---|
| townships.geojson | 11.4 MB | **0** (ใช้ labels 31 KB) |
| states.geojson | 4.5 MB | 4.5 MB (คงไว้ — state boundaries/labels) |
| showrooms.json | 1.6 KB | 1.6 KB |
| **รวม map mount** | **~15.9 MB** | **~4.5 MB (−71%)** |

**รวมกับ F3 phase 1:** marketing session 1 ครั้ง ~29 MB → **~6.4 MB** (page 1.9 MB + map 4.5 MB)

## 5. TEST RESULTS

| Gate | ผล |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| ESLint (maplibre file) | ✅ 0 errors, 2 warnings เดิม (exhaustive-deps) |
| `npm test` (full suite + build) | ✅ **389/389 pass** (+1 labels test) |

## 6. KNOWN NOTES

- Legacy map (`myanmar-marketing-map.tsx`, rollback path เมื่อ `getMapEngine() === "legacy"`) ยังอ้าง townships geojson — ถูกต้อง (fallback ต้องมี geometry จริง); ไม่กระทบ default path
- `mm-townships-geojson` ยังลงทะเบียนใน `data/maps/datasets.json` (map-foundation test ยืนยัน enabled) — เป็น config ที่ไม่โหลดเอง
- ถ้า geojson ต้นทางเปลี่ยน → ต้องรัน `npm run maps:labels:mm` ใหม่ (มี regression test ตรวจ coordinate mismatch)

**READY_FOR_REVIEW = YES**
