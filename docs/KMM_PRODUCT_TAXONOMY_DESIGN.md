# KMM Canonical Product Taxonomy — Design (E2 Fix)

- **Date:** 2026-08-15 · **Status:** Proposal — no code changed
- **Fixes:** E2 (product-type classification inconsistent across Sales/Booking/Stock/KAI)
- **Related:** `reports/static-audit-phase1-deepdive-p0p1.md` §E2 · A1/F1 (migration rollout) · E3 (target product groups)

---

## 1. เป้าหมายและข้อจำกัด (Design goals & constraints)

**ปัญหา (ย่อ):** source workbooks ใช้ product-code convention ต่างกัน — Sales `04-EX`/`03-TP`, Stock `03-EX`/`04-TP` (EX/TP สลับ), Booking `TT`/`CH`/`EX` (code เปล่า) — และมี 4 ตาราง mapping คู่ขนาน (sales/booking/stock selectors + KAI `PRODUCT_CODES`) + `productCategory()` substring อีก 1 → ข้อมูลจริงตัวเดียวกัน classify ต่างกันต่อโมดูล และไม่มี validation จับ code ใหม่/แปลกปลอม

**ข้อจำกัดที่บังคับ design:**
1. **Selectors ทำงานแบบ sync บน client** — `dashboard-page`, `booking-page`, `stock-page` เรียก normalize หลัง fetch rows → classification ต้องเป็น **pure function แบบ sync ใน TS module** (ห้ามเป็น DB call)
2. **ต้องมี single source of truth เพียงแหล่งเดียว** ที่ทุก consumer import
3. **ห้ามเปลี่ยนพฤติกรรมกับข้อมูลปัจจุบัน** ยกเว้นจุดที่เป็น bug ของ E2 (ต้อง diff รายงานก่อน-หลัง)
4. รองรับ multi-company (KM อนาคตอาจมี code ต่าง) — ตาม pattern `business_targets` (ค่า `''` = company-wide)

**สถาปัตยกรรม 2 ชั้น:**
- **ชั้น runtime (authority):** TS module `lib/dashboard/product-codes.ts` — ใช้กับทุกการ classify ทั้ง client/server (รวม Data Hub validation ซึ่งรันทั้ง preview-client และ import-server)
- **ชั้น governance (mirror):** ตาราง D1 `product_codes` — seed **จาก TS module โดย generator** (ไม่ใช่ source ที่สอง) ใช้สำหรับ data dictionary, drift check, และ parity test ที่บังคับไม่ให้สองชั้นแยกกัน

---

## 2. Canonical Taxonomy (จากข้อมูลจริง + 4 ตารางปัจจุบัน)

### 2.1 รายการ code ต่อโมดูล (verified จาก `public/dashboard-data.json` + `data-import-report.json`)

| raw_code | Sales | Booking | Stock | canonical | หมายเหตุ |
|---|---|---|---|---|---|
| `01-TT` / `TT` / `01TT` | ✅ | ✅ (plain) | ✅ | **TT** | tractor |
| `02-CH` / `CH` / `02CH` | ✅ | ✅ (plain) | ✅ | **CH** | combine |
| `03-TP` / `03TP` | ✅ | — | ❌ (stock ใช้ `04-TP`) | **TP** | transplanter |
| `04-EX` / `04EX` | ✅ | ✅ | ❌ (stock ใช้ `03-EX`) | **EX** | excavator |
| `03-EX` / `03EX` | ❌ | — | ✅ | **EX** | **เฉพาะ stock workbook** — ต้องยืนยันกับทีมธุรกิจ |
| `04-TP` / `04TP` | ❌ | — | ✅ | **TP** | **เฉพาะ stock workbook** — ต้องยืนยันกับทีมธุรกิจ |
| `06-IM` / `06IM` / `IM` | ✅ | — | ✅ | **IM** | implement |
| `07-IMO` / `07IMO` / `IMO` | ✅ | — | ✅ | **IMO** | implement option |
| `08-OT` / `08OT` / `OT` | ✅ | — | — | **OT** | other (stock ใช้ `08-TX` แทน → ดูด้านล่าง) |
| `MAX` / `05MAX` | ✅ | — | ✅ | **MAX** | (booking alias มี `05MAX` เช่นกัน) |
| `05-TX` | 4 rows | — | — | **UNKNOWN** | known-unknown (ไม่ map เป็น MAX!) |
| `08-TX` | — | — | 3 rows | **UNKNOWN** | known-unknown (stock) |
| `MITSU` | 1 row | — | — | **UNKNOWN** | known-unknown |
| `?` | 159 rows | — | — | **UNKNOWN** | ควรเป็น error ในการ import ครั้งถัดไป (ดู §7) |

> ⚠️ **คำเตือนสำคัญ:** `05-TX` มีความใกล้เคียง `05MAX` และ `08-TX` ใกล้เคียง `08-OT` แต่ **ห้าม map อัตโนมัติ** — KAI รองรับ fail-closed อยู่แล้ว (`unresolvedProductCode` → "canonical product mapping unavailable") ต้องให้ทีมธุรกิจยืนยันก่อน

### 2.2 กลุ่มหลัก (canonical groups)

```
UNIT (engine-unit, นับ Sales Unit):  TT  CH  EX  TP  MAX
VALUE (นับ Sales Value / Stock MSRP): TT  CH  EX  TP  MAX  IM  IMO  OT
```

---

## 3. TS Module — `lib/dashboard/product-codes.ts` (runtime authority)

```ts
// lib/dashboard/product-codes.ts
export type ProductGroup = "TT" | "CH" | "EX" | "TP" | "MAX" | "IM" | "IMO" | "OT";
export type ProductModule = "sales" | "booking" | "stock";

export type ProductCodeEntry = {
  /** null = known-unknown (unverified) เช่น 05-TX / MITSU */
  group: ProductGroup | null;
  verification: "VERIFIED" | "UNVERIFIED";
};

/** Mapping เฉพาะโมดูล: normalized key -> entry */
export const MODULE_CODES: Record<ProductModule, Record<string, ProductCodeEntry>> = {
  sales: {
    "01TT": { group: "TT", verification: "VERIFIED" },
    "02CH": { group: "CH", verification: "VERIFIED" },
    "03TP": { group: "TP", verification: "VERIFIED" },
    "04EX": { group: "EX", verification: "VERIFIED" },
    "06IM": { group: "IM", verification: "VERIFIED" },
    "07IMO": { group: "IMO", verification: "VERIFIED" },
    "08OT": { group: "OT", verification: "VERIFIED" },
    "05TX": { group: null, verification: "UNVERIFIED" },
    MITSU: { group: null, verification: "UNVERIFIED" },
  },
  booking: {
    TT: { group: "TT", verification: "VERIFIED" },
    CH: { group: "CH", verification: "VERIFIED" },
    EX: { group: "EX", verification: "VERIFIED" },
    "01TT": { group: "TT", verification: "VERIFIED" },
    "02CH": { group: "CH", verification: "VERIFIED" },
    "04EX": { group: "EX", verification: "VERIFIED" },
    "05MAX": { group: "MAX", verification: "VERIFIED" },
    // booking ยังไม่มี numeric IM/IMO/OT — ถ้า workbook เพิ่ม code จะถูกจับโดย Data Hub validation
  },
  stock: {
    "01TT": { group: "TT", verification: "VERIFIED" },
    "02CH": { group: "CH", verification: "VERIFIED" },
    "03EX": { group: "EX", verification: "VERIFIED" },   // convention ของ stock workbook
    "04TP": { group: "TP", verification: "VERIFIED" },   // convention ของ stock workbook
    "06IM": { group: "IM", verification: "VERIFIED" },
    "07IMO": { group: "IMO", verification: "VERIFIED" },
    "05MAX": { group: "MAX", verification: "VERIFIED" },
    "08TX": { group: null, verification: "UNVERIFIED" },
  },
};

/** Code เปล่าที่ใช้ร่วมได้ทุกโมดูล (booking เป็นหลัก) */
export const GLOBAL_CODES: Record<string, ProductGroup> = {
  TT: "TT", CH: "CH", EX: "EX", TP: "TP", MAX: "MAX",
  IM: "IM", IMO: "IMO", OT: "OT",
};

export const PRODUCT_GROUPS = {
  UNIT: ["TT", "CH", "EX", "TP", "MAX"] as const,
  VALUE: ["TT", "CH", "EX", "TP", "MAX", "IM", "IMO", "OT"] as const,
} as const;

export type ClassificationMatch = "module_code" | "global_code" | "unverified_code" | "missing";

export type ProductClassification = {
  group: ProductGroup | "Unknown";
  /** provenance สำหรับ data-quality / KAI fail-closed */
  matchedBy: ClassificationMatch;
  rawCode: string;
  verified: boolean;
};

export function normalizeProductCode(value: unknown): string;
  // trim + uppercase + strip อักษรที่ไม่ใช่ A-Z0-9 (เหมือน key() เดิม) — tolerance ต่อ "04-EX" / "04EX"

export function classifyProduct(input: {
  module: ProductModule;
  productType?: unknown;
  productGroup?: unknown;   // stock ใช้ productGroup มาก่อน productType (ตามเดิม)
}): ProductClassification;
  // precedence: module code -> global code -> unverified (known-unknown) -> missing
  // หมายเหตุ: ไม่มี model fallback — ตัดสินใจร่วมกัน (ดู §10)

export function isEngineUnit(group: ProductGroup | "Unknown"): boolean;  // UNIT.includes
export function isValueProduct(group: ProductGroup | "Unknown"): boolean; // VALUE.includes
export function isUnverifiedCode(module: ProductModule, raw: unknown): boolean; // KAI ใช้แทน regex
export function productLabel(group: ProductGroup, locale: "en" | "th" | "my"): string;
```

**เหตุผลที่ไม่มี model fallback:** หลักการเดียวกับที่ sales มีอยู่แล้ว ("Model text must never participate") — model substring เกิด misclassify ได้ (เช่น model ที่มี "TT"/"IM" แทรก) และเป็นต้นตอของ `productCategory()` ที่เราจะเลิกใช้

---

## 4. D1 Schema — ตาราง `product_codes` (managed mirror)

```sql
CREATE TABLE `product_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL DEFAULT '',          -- '' = global; KM override อนาคต
  `module` text NOT NULL,                          -- 'sales' | 'booking' | 'stock'
  `raw_code` text NOT NULL,                        -- ค่า source จริง เช่น '04-EX', 'TT', 'MITSU'
  `canonical_group` text NOT NULL,                 -- 'TT'|...|'OT'|'UNKNOWN'
  `verification` text NOT NULL DEFAULT 'VERIFIED', -- 'VERIFIED' | 'UNVERIFIED'
  `product_label_en` text NOT NULL DEFAULT '',
  `product_label_th` text NOT NULL DEFAULT '',
  `product_label_my` text NOT NULL DEFAULT '',
  `source` text NOT NULL DEFAULT '',               -- เช่น 'CPI v3 sales workbook'
  `status` text NOT NULL DEFAULT 'active',         -- 'active' | 'inactive' (code ถูกยกเลิก)
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` text NOT NULL,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` text NOT NULL
);
CREATE UNIQUE INDEX `product_codes_scope_unique` ON `product_codes` (`company_id`, `module`, `raw_code`);
CREATE INDEX `product_codes_group_idx` ON `product_codes` (`company_id`, `canonical_group`, `status`);
CREATE INDEX `product_codes_module_idx` ON `product_codes` (`company_id`, `module`, `status`);
```

- `raw_code` เก็บ **ค่าดั้งเดิม** (ไม่ใช่ normalized key) เพื่อ audit ว่า source จริงส่งอะไรเข้ามา
- `canonical_group='UNKNOWN'` + `verification='UNVERIFIED'` = known-unknown (`05-TX`/`MITSU`/`08-TX`) → KAI/Data Hub อ่านจากตารางได้แทน regex
- `status='inactive'` = code ที่เลิกใช้แล้ว (ยังเก็บประวัติไว้)
- **Migration เกิดจาก generator:** `scripts/generate_product_codes_migration.mjs` อ่าน `MODULE_CODES`/`GLOBAL_CODES` จาก TS module → ปล่อย `drizzle/operations/0041_product_codes_seed.sql` → **ไม่มีทาง drift ระหว่าง TS กับ DB** + parity test อีกชั้น

---

## 5. API Contract — `GET /api/product-codes`

**จุดประสงค์:** data dictionary / governance UI / drift check — **ไม่ใช่** path ของ runtime classification (client ใช้ TS module)

```
GET /api/product-codes?companyId=kmm-company
Authorization: Bearer <firebase token>   (requireCompanyContext, permission: view)
```

**200 OK**
```jsonc
{
  "source": "d1",
  "meta": {
    "generatedAt": "2026-08-15T06:00:00Z",
    "companyId": "kmm-company",
    "taxonomyVersion": "v1"
  },
  "groups": {
    "TT":  { "unit": true,  "value": true,  "label": { "en": "Tractor", "th": "รถแทรกเตอร์", "my": "" } },
    "IM":  { "unit": false, "value": true,  "label": { "en": "Implement", "th": "อุปกรณ์", "my": "" } },
    "UNKNOWN": { "unit": false, "value": false, "label": { "en": "Unclassified", "th": "ยังไม่ระบุ", "my": "" } }
  },
  "codes": [
    { "rawCode": "04-EX", "module": "sales", "canonicalGroup": "EX", "verification": "VERIFIED", "status": "active", "label": { "en": "Excavator", "th": "รถขุด", "my": "" }, "source": "CPI v3" },
    { "rawCode": "03-EX", "module": "stock", "canonicalGroup": "EX", "verification": "VERIFIED", "status": "active", "label": {}, "source": "KMM stock workbook" },
    { "rawCode": "MITSU", "module": "sales", "canonicalGroup": "UNKNOWN", "verification": "UNVERIFIED", "status": "active", "label": {}, "source": "CPI v3" }
  ]
}
```

**Errors:** `401` (ไม่มี token) · `403` (ไม่มี membership/role) · `500` (D1 ไม่พร้อม)

**สิทธิ์:** view เท่านั้น (read-only) · cache: `no-store` (ข้อมูลนิยามสั้น ไม่มีเหตุผลต้อง cache)

---

## 6. Consumer Integration Map

| # | Consumer | ปัจจุบัน | หลังแก้ |
|---|---|---|---|
| 1 | `lib/sales/business-service.ts` `salesProductGroup()` | local map `SALES_PRODUCT_TYPE_GROUPS` | `classifyProduct({ module: "sales", productType })` · `isEngineUnitProduct`/expense scope ใช้ `PRODUCT_GROUPS.UNIT/VALUE` |
| 2 | `lib/dashboard/booking-selectors.ts` `normalizeBookingProduct()` | local `PRODUCT_ALIASES` | `classifyProduct({ module: "booking", productType })` (ได้ numeric IM/IMO/OT ฟรีเมื่อเพิ่มใน taxonomy) |
| 3 | `lib/dashboard/stock-selectors.ts` `normalizeProductType()` | local `aliases` + model fallback | `classifyProduct({ module: "stock", productType, productGroup })` · ลบ model fallback (ดู §10) |
| 4 | `lib/dashboard/product-groups.ts` `productCategory()` | substring บน type+model | แทนด้วย `classifyProduct` — หน้า Booking (display + `isUnitProduct`) ใช้กลุ่ม canonical เดียวกัน |
| 5 | `lib/kai/runtime-query-v2.ts` `PRODUCT_CODES` + `unresolvedProductCode()` | const ในไฟล์ + regex `05-TX|08-TX|MITSU` | import `MODULE_CODES`/`isUnverifiedCode` จาก module · target grouping (`TT`/`CH`/`EX_TP`) เป็น **target rule** ใน targets layer (ไม่ใช่ taxonomy) |
| 6 | `lib/kai/executive-intelligence.ts` | import normalize เดิม | ไม่เปลี่ยน logic — import canonical functions |
| 7 | `lib/operations/business-service.ts` + pages | import normalize เดิม | ไม่เปลี่ยน (ผูกกับ #2/#3) |
| 8 | Data Hub (ดู §7) | ไม่มี | validator ใหม่ |

**กฎการ migration ของ consumer:** สลับทีละตัว (sales → booking → stock → KAI → productCategory) แต่ละตัวมี regression test + **diff report** เทียบ classification เดิมกับใหม่บน fixture จริง — ผลต่างที่ยอมรับได้ต้องเป็นเฉพาะจุด E2 (stock EX/TP, known-unknown) เท่านั้น

---

## 7. Data Hub Import Validation (ปิดช่อง silent wrongness)

**ที่ต้องแก้ใน `lib/data-hub`:**

1. `source-definitions.ts` — เพิ่ม metadata ในนิยาม sales/booking/stock:
   ```ts
   productCode: { field: "product_type"; module: "sales" as ProductModule }
   ```
   (stock อาจเช็คทั้ง `product_type` และ `product_group`)

2. `types.ts` — เพิ่ม issue codes:
   ```ts
   export type ValidationIssueCode =
     | ...existing
     | "unknown_product_code"      // ไม่อยู่ใน taxonomy เลย
     | "unverified_product_code";  // อยู่ใน known-unknown list (05-TX/MITSU/08-TX)
   ```

3. `validate-import.ts` — ใน loop ต่อแถว: ถ้า field product type มีค่า → `classifyProduct`:
   - `matchedBy === "missing"` → **error** `unknown_product_code` (row + raw value) → import ถูก block (ตาม `canImport` เดิมที่ error = block) พร้อมรายงานแถว
   - `matchedBy === "unverified_code"` → **warning** `unverified_product_code` (KAI จะ fail-closed อยู่แล้ว, import ผ่านได้แต่ถูก flag ใน history)
   - `verification === "VERIFIED"` → ผ่าน

4. **ผลลัพธ์:** code ใหม่/แปลกปลอม (เช่น stock เริ่มใช้ `04-EX` โดยไม่ตั้งใจ) จะถูกจับที่ import **ก่อน** เข้า D1 แทนที่จะกลายเป็น Unknown เงียบ ๆ ใน dashboard

---

## 8. Rollout Plan

1. **Phase A — TS module + baseline diff:** สร้าง `product-codes.ts` + unit tests · เขียน script diff classification เดิม vs ใหม่บน `public/dashboard-data.json` → ยืนยันว่าผลต่าง = เฉพาะจุด E2
2. **Phase B — สลับ consumer ทีละตัว** (#1→#8 ตามตาราง §6) แต่ละตัวมี regression test
3. **Phase C — Data Hub validation** (§7) + ทดสอบ preview/import flow
4. **Phase D — D1 mirror:** generator → migration `0041` → `parity test` (rows ใน DB == TS module) · **รันบน staging ก่อน** (ผูก A1/F1 — ต้องเคลียร์ migration topology)
5. **Phase E — Business confirmation + docs:** ยืนยัน EX/TP ของ stock workbook, ชะตากรรม `05-TX`/`08-TX`/`MITSU`/`?`, taxonomy สำหรับ KM · อัปเดต data dictionary

**Tests ใหม่:**
- `product-codes.test.mjs`: classify ทุก raw code จริง → canonical group ถูกต้อง; precedence (module > global > unverified > missing); `isEngineUnit`/`isValueProduct`
- `product-codes-parity.test.mjs`: `product_codes` table == TS module (guard drift)
- `data-hub-product-code-validation.test.mjs`: import ที่มี code ใหม่ → error + row report; code known-unknown → warning; code ปกติ → ผ่าน
- `product-classification-parity.test.mjs`: fixture เดียว classify ผ่านฟังก์ชันของทั้ง 4 consumer ได้ผลเดียวกัน

---

## 9. Summary Diagram

```
                 TS module (lib/dashboard/product-codes.ts)  ←── runtime authority (sync pure)
                 │
      ┌──────────┼──────────────┬───────────────┬───────────────┐
      ▼          ▼              ▼               ▼               ▼
 sales       booking        stock          product-groups   KAI runtime
 business-   selectors     selectors      (booking page    (MODULE_CODES,
 service     (normalize)   (normalize)    productCategory)  isUnverifiedCode)
      │          │              │
      ▼          ▼              ▼
 Data Hub validate-import ──► warning/error per code (block silent Unknown)
      │
      ▼
 generator ──► migration 0041 ──► D1 product_codes ──► parity test ──► GET /api/product-codes
 (จาก TS module เดียวกัน)                                              (data dictionary / governance)
```

---

## 10. Open Decisions (ต้อง confirm กับทีม)

1. **Stock EX/TP:** `03-EX`/`04-TP` เป็น convention ที่ถูกต้องของ stock workbook จริง หรือควร reconcile เป็น `04-EX`/`03-TP` ตาม sales? (design รองรับทั้งสอง — แค่เปลี่ยนแถวในตาราง)
2. **ชะตากรรม known-unknowns:** `05-TX` → MAX?, `08-TX` → OT?, `MITSU` → ? — ต้องมีคนถือครองคำตอบ ไม่ map เอง
3. **`?` (159 แถวใน sales):** ควรเป็น error ในการ import ถัดไป (missing product type) — ยืนยันว่าไม่ใช่ data ดีที่ถูกเขียนผิด
4. **Model fallback ของ stock:** ลบออก (unknown + flag) หรือเก็บเป็น heuristic แสดงผลเฉย ๆ — แนะนำลบ เพื่อความสม่ำเสมอ
5. **KM (Thailand):** ยังไม่มีข้อมูล — เตรียม company-scoped rows ไว้ใน schema แล้ว
6. **EX_TP target group:** ยืนยันว่าเป็น business rule ระดับ target (ไม่ใช่ product taxonomy) และอยู่ที่ targets layer
