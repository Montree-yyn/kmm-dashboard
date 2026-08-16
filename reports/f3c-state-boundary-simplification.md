# F3 Phase 3 — Simplify State Boundary Geometry

**Status:** DONE — build + full suite green. **ไม่ commit / ไม่ deploy** รอ review

**Scope:** Performance only — ไม่แตะ marketing business logic / KPI / map UX / region mapping / sales territory logic

---

## 1. AUDIT — states.geojson (ก่อนแก้)

| ตัวชี้วัด | ค่า |
|---|---|
| Feature count | 15 (15 states/regions, `ST` + `ST_PCODE` ไม่ซ้ำ) |
| Geometry type | MultiPolygon ทั้งหมด |
| Coordinate pairs | **117,536** |
| ขนาดไฟล์ | **4,533 KB** (4.5 MB) |
| ใช้ใน map | `marketing-state-boundaries` (line layer) + `marketing-state-labels` (`getLabelPositions` = vertex-mean) |

โหลดตอน map mount — 4.5 MB เพื่อวาด state boundary line + label เท่านั้น

## 2. CHANGES

### ใหม่: `scripts/maps/simplify_myanmar_states.py`
- **Douglas-Peucker** ต่อ polygon ring (tolerance 0.01° ≈ 1.1 km ที่ละติจูดพม่า)
- **Preserve:** 15 features, properties เดิม (ST / ST_PCODE / ST_RG / ST_MMR / PCode_V), โครงสร้าง MultiPolygon, rings ปิด + ≥4 points (ring ที่ collapse กลับเป็นต้นฉบับ — ไม่ drop)
- **Precompute `label_position`** จาก geometry **ต้นฉบับ** (vertex-mean เดียวกับ `getLabelPositions`) → label ตำแหน่งไม่ขยับ
- Output: `public/maps/myanmar-states-simplified.geojson` — **358 KB**

### แก้: `components/marketing/myanmar-marketing-map-maplibre.tsx`
- `loadStatesGeometry()`: โหลด `/maps/myanmar-states-simplified.geojson` (production path) → **fallback** `/maps/myanmar-states.geojson` (original เต็ม resolution) ถ้า simplified ไม่มี
- State labels: ใช้ `label_position` จาก properties (fallback เป็น `getLabelPositions` ถ้าเป็นไฟล์ original)
- `GeoFeature.properties` เพิ่ม `label_position?: [number, number]`

### แก้: `tests/map-foundation.test.mjs`
- อัปเดต: maplibre ต้องอ้างทั้ง simplified (production) + original (fallback)
- **+1 test ใหม่**: 15 features, IDs (ST|ST_PCODE) ตรงกัน, ขนาด <1 MB, coordinates ≤25% ของเดิม, label_position = vertex-mean ต้นฉบับทุก feature

### แก้: `package.json`
- เพิ่ม `maps:simplify:states` + ต่อท้าย `maps:pipeline:mm`

## 3. BEFORE / AFTER

| ตัวชี้วัด | Before | After | ลด |
|---|---|---|---|
| ขนาดไฟล์ | 4,533 KB | **358 KB** | **−92%** |
| Coordinate pairs | 117,536 | **9,365** | **−92%** |
| Feature count | 15 | 15 | 0 (เหมือนเดิม) |
| State IDs | 15 | 15 | 0 mismatch |

### Visual accuracy verification
| ตรวจ | ผล |
|---|---|
| IDs ตรงกัน (ST \| ST_PCODE) | ✅ identical |
| `label_position` = vertex-mean ต้นฉบับ | ✅ **0 mismatches** (15/15) — label ไม่ขยับ |
| Invalid rings (เปิด/<4 points) | ✅ 0 |
| Build bundle | ✅ 358 KB ใน dist/client/maps |

### Marketing map mount payload (รวม F3 ทั้ง 3 phases)
| | Before | After |
|---|---|---|
| townships.geojson | 11.4 MB | 0 (labels 31 KB) |
| states.geojson | 4.5 MB | **0.36 MB** (simplified; original = fallback เท่านั้น) |
| showrooms.json | 1.6 KB | 1.6 KB |
| **รวม map mount** | **~15.9 MB** | **~0.39 MB (−97.5%)** |

## 4. TEST RESULTS

| Gate | ผล |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| ESLint (maplibre) | ✅ 0 errors, 2 warnings เดิม (exhaustive-deps) |
| `npm test` (full suite + build) | ✅ **390/390 pass** (+1) |

## 5. KNOWN NOTES

- Tolerance 0.01° เลือกจาก benchmark 3 ค่า (0.005→468KB / **0.01→358KB** / 0.02→407KB — 0.02 กลับใหญ่ขึ้นเพราะ ring เล็ก collapse แล้วกันกลับต้นฉบับ)
- Ring ที่ simplify ต่ำกว่า 3 points → กันเป็น ring เดิม (ไม่ drop → ไม่เสียพื้นที่/เกาะ)
- Shared borders ระหว่าง state: DP แยกต่อ ring → ขอบที่ใช้ร่วมกันอาจต่างกันเล็กน้อยระดับ <1px ที่ zoom 6–7 — มองไม่เห็น
- ถ้าต้องการปรับความคมชัด: `python3 scripts/maps/simplify_myanmar_states.py 0.005` (468 KB) — มี regression test คุ้มครองข้อจำกัด (IDs/label/size)

**READY_FOR_REVIEW = YES**
