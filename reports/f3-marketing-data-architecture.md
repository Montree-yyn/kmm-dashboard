# F3 — Enterprise Marketing Data Architecture Optimization

**Status:** DONE (phase 1) — build + full suite green. **ไม่ commit / ไม่ deploy** รอ review

**Scope:** Performance only — ไม่แตะ business logic, KPI definitions, marketing calculations, UI design, map UX

---

## 1. AUDIT — Marketing data flow (ก่อนแก้)

| ทรัพยากร | ขนาด | ใคร fetch | ใช้ทำอะไร |
|---|---|---|---|
| `/dashboard-data.json` | **1.8 MB** | marketing page (`load()` ตอน mount) | sales rows + marketing activities + booking + meta |
| `/maps/myanmar-townships.geojson` | **11.4 MB** | **page-level** (line 3074) | อ่านแค่ `properties.TS`/`properties.ST` — **geometry ถูกทิ้ง** |
| `/maps/myanmar-townships.geojson` | 11.4 MB | map overlay (`installLegacyPresentationOverlays`) | label positions + state boundaries |
| `/maps/myanmar-states.geojson` | 4.5 MB | map overlay | state boundaries + state labels |
| `/maps/kmm-showrooms.json` | 1.6 KB | map overlay | showroom markers |

**Initial payload (ก่อน map mount):** 1.8 + 11.4 = **~13.2 MB** — ทั้งที่หน้าใช้แค่ชื่อ township/state จากไฟล์ 11.4 MB (type `GeoTownship = { properties: { TS, ST } }` ไม่มี geometry)

**Key findings ที่จำกัด scope:**
- **Marketing activities ไม่มีใน D1** (ไม่มีตาราง activity ใน schema/local D1) → แทน `dashboard-data.json` ด้วย API ทั้งหมด = **ข้อมูลหาย** (violates no-data-loss)
- **sales_transactions ไม่มีคอลัมน์ township/stateRegion** (มีแค่ branch) → marketing geography attribution จาก API โดยตรงจะเพี้ยน (violates no-business-logic-change)
- `data/master-townships.json` (112 KB, import อยู่แล้ว) มีชื่อ canonical ครบ **330/330** ตรงกับ geojson (0 missing) — ใช้แทน page-level geojson ได้เป๊ะ

## 2. CHANGES

**`components/marketing/marketing-intelligence-page.tsx`:**
1. **ลบ fetch `/maps/myanmar-townships.geojson` (11.4 MB) ระดับหน้า** → derive `geoTownships` จาก `townshipMaster` (`TS: record.township, ST: record.state_region`) — ข้อมูลชื่อ/state เหมือนเดิม 100% (330 รายการ 0 missing) แต่ไม่ต้องโหลด geometry 11.4 MB
2. **`dashboard-data.json` → ผ่าน `client-data-layer`** (key `marketing:data`, TTL 10 นาที — เป็น build-time artifact ไม่เปลี่ยนตอน runtime) → กลับมา-ไปหน้า marketing ภายใน TTL ไม่ re-fetch; รักษา response contract เดิม (type `Data` เหมือนเดิม)

**ไม่แตะ:** map overlay (labels/state boundaries ต้องใช้ geometry จริง) — เหลือเป็น deferred item พร้อม proposal

## 3. BEFORE / AFTER

### Initial payload (หน้า marketing, ก่อน map mount)
| | Before | After | ลด |
|---|---|---|---|
| dashboard-data.json | 1.8 MB (fetch ทุก mount) | 1.8 MB (cache TTL 10 นาที) | re-fetch 0 ครั้งหลังแรก |
| townships geojson (page) | 11.4 MB | **0** (ใช้ master 112 KB ที่ bundle อยู่แล้ว) | −100% |
| **รวม initial** | **~13.2 MB** | **~1.9 MB** | **−86%** |

### Network requests
| Scenario | Before | After |
|---|---|---|
| Marketing mount | 2 requests (data + geojson 11.4 MB) | 1 request (data) |
| กลับมา-ไป marketing ภายใน 10 นาที | re-fetch 1.8 MB + 11.4 MB | **0 requests** (data-layer cache) |

### Map (documented remaining)
- Map overlay ยังโหลด `townships.geojson` 11.4 MB + `states.geojson` 4.5 MB ตอน map mount — **จำเป็น** สำหรับ label positions/state boundaries (master มี `latitude/longitude: null` จึงแทน geometry ไม่ได้)
- Proposal (P1): generate township-labels dataset ผ่าน `scripts/maps/` (point per township) + เปลี่ยน `installLegacyPresentationOverlays` ให้ใช้ไฟล์เล็กแทน → ต้องอัปเดต assertions ใน `map-foundation.test.mjs` (ผูก URL geojson ปัจจุบัน) — **defer แยกงาน**

## 4. FILES CHANGED

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `components/marketing/marketing-intelligence-page.tsx` | ลบ page-level geojson fetch + state → derive จาก master; `load()` → `client-data-layer` (TTL 10 นาที); ใช้ `townshipMaster` ที่ import ค้างอยู่ (แก้ unused ด้วย) |

ไม่แตะ: business logic / KPI / calculations / API / schema / map UX / public files (dashboard-data.json + geojson ยังอยู่ — ใช้โดย map overlay + fallback paths)

## 5. TEST RESULTS

| Gate | ผล |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| ESLint (marketing page) | ✅ 0 errors, 33 warnings (ลดจาก 34 — townshipMaster ถูกใช้แล้ว; เหลือเป็น warnings เดิมของ monolith) |
| Targeted (map-foundation/marketing-regression/sales-live-integration/dashboard-source-safety/rendered-html) | ✅ 52/52 |
| `npm test` (full suite + build) | ✅ **388/388 pass** |

## 6. SUMMARY

- Initial payload: **13.2 MB → 1.9 MB (−86%)** — ไม่แตะ business logic/data
- Requests: marketing mount 2 → 1; back-nav 2+ → 0 (client-data-layer)
- ยังไม่สามารถย้าย `dashboard-data.json` ไป API โดยไม่เสีย marketing activities หรือเพี้ยน geography attribution (ต้องมี D1 schema + import pipeline ก่อน — งาน data-model ไม่ใช่ performance-only)
- Map overlay (11.4 MB + 4.5 MB ตอน map mount) = deferred item พร้อม proposal แยกงาน

**READY_FOR_REVIEW = YES**
