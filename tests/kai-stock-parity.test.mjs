import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { formatBusinessAnswer, isExecutiveQuestion, isKmmBusinessQuestion, selectKmmStockSnapshotRows, summarizeKmmStockRows } = await tsImport("../lib/kai/tools/kmm-business.ts", import.meta.url);

const stockRow = (overrides = {}) => ({
  date: "2026-08-08",
  year: 2026,
  month: 8,
  branch: "KMM01",
  salesperson: "",
  kmm: 1,
  productType: "01-TT",
  productGroup: "01-TT",
  model: "M7040",
  ageBucket: "0–30",
  ageDays: 1,
  snapshotDate: "2026-08-08",
  msrp: 100,
  stockId: null,
  serialNumber: null,
  engineNumber: null,
  chassisNumber: null,
  currentStatus: "FREE STOCK",
  ...overrides,
});

test("KAI stock summary uses the Dashboard's de-duplicated vehicle population for every aggregate", () => {
  const duplicateVehicle = stockRow({ chassisNumber: "CH-001" });
  const rows = [
    duplicateVehicle,
    stockRow({ chassisNumber: "CH-001", branch: "KMM02" }),
    stockRow({ chassisNumber: "CH-002", branch: "KMM02", productType: "02-CH", productGroup: "02-CH", model: "DC70" }),
    // Value-only rows remain outside the Unit KPI, exactly as in Dashboard.
    stockRow({ chassisNumber: "IM-001", productType: "06-IM", productGroup: "06-IM", model: "Implement" }),
    // Non-current rows are excluded before de-duplication.
    stockRow({ chassisNumber: "OLD-001", currentStatus: "SOLD" }),
  ];

  const summary = summarizeKmmStockRows(rows);
  assert.equal(rows.length, 5);
  assert.equal(summary.units, 2);
  assert.equal(summary.stockValue, 300);
  assert.equal(summary.snapshotDate, "2026-08-08");
  assert.deepEqual(summary.productBreakdown.filter((item) => item.unit > 0), [
    { product: "TT", unit: 1, value: 100 },
    { product: "CH", unit: 1, value: 100 },
  ]);
  assert.deepEqual(summary.branchBreakdown, [
    { branch: "KMM01", units: 1, stockValue: 200 },
    { branch: "KMM02", units: 1, stockValue: 100 },
  ]);
});

test("canonical stock de-duplication rejects any shared normalized physical identifier", () => {
  const rows = [
    stockRow({ chassisNumber: "CH-001", engineNumber: "ENG-001", serialNumber: "SN-001", stockId: "ST-001" }),
    stockRow({ chassisNumber: "CH-002", engineNumber: "eng 001", serialNumber: "SN-002", stockId: "ST-002", branch: "KMM02" }),
    stockRow({ chassisNumber: "ch 002", engineNumber: "ENG-003", serialNumber: "SN-003", stockId: "ST-003", branch: "KMM03" }),
    stockRow({ chassisNumber: "CH-004", engineNumber: "N/A", serialNumber: null, stockId: "ST-004" }),
    stockRow({ chassisNumber: "CH-005", engineNumber: "N/A", serialNumber: null, stockId: "ST-005" }),
  ];

  const summary = summarizeKmmStockRows(rows);
  assert.equal(summary.units, 3);
  assert.equal(summary.stockValue, 300);
  assert.deepEqual(summary.branchBreakdown, [
    { branch: "KMM01", units: 3, stockValue: 300 },
  ]);
});

test("KAI routes descriptive stock branch breakdowns to the canonical stock summary", () => {
  const message = "สรุป Stock ปัจจุบันของ KMM: จำนวน Unit, มูลค่า, snapshot date และแยกตามสาขา";
  assert.equal(isKmmBusinessQuestion(message), true);
  assert.equal(isExecutiveQuestion(message), false);

  const summary = summarizeKmmStockRows([
    stockRow({ chassisNumber: "CH-101", branch: "Hpa-an", msrp: 10_000 }),
    stockRow({ chassisNumber: "CH-102", branch: "KMM01", msrp: 1_000 }),
    stockRow({ chassisNumber: "CH-103", branch: "Mawlamyine", msrp: 1_000 }),
  ]);
  assert.deepEqual(summary.branchBreakdown, [
    { branch: "KMM01", units: 2, stockValue: 11_000 },
    { branch: "KMM02", units: 1, stockValue: 1_000 },
  ]);
});

test("KAI stock responses use snapshot metadata rather than a monthly range", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../lib/kai/tools/kmm-business.ts", import.meta.url), "utf8"));
  assert.match(source, /ข้อมูล Stock ณ วันที่/);
  assert.match(source, /result\.area !== "stock"/);
});

test("KAI never substitutes a current Stock snapshot for a historical month", () => {
  const rows = [
    stockRow({ snapshotDate: "2026-07-31", chassisNumber: "JUL-1" }),
    stockRow({ snapshotDate: "2026-08-08", chassisNumber: "AUG-1" }),
  ];
  const july = { kind: "dateRange", start: "2026-07-01", end: "2026-07-31", label: "named month", scopeLabel: "กรกฎาคม 2026" };
  assert.deepEqual(selectKmmStockSnapshotRows(rows, july).map((row) => row.chassisNumber), ["JUL-1"]);
  assert.deepEqual(selectKmmStockSnapshotRows(rows, { ...july, start: "2026-06-01", end: "2026-06-30" }), []);
});

test("KAI formats canonical Township rankings for Dashboard year-range questions", () => {
  const message = "สรุปพื้นที่ขายรวมเยอะที่สุด ตั้งแต่ปี 2023-2026 อันดับ 1-5";
  assert.equal(isKmmBusinessQuestion(message), true);
  const answer = formatBusinessAnswer(message, {
    source: "KMM Internal Data",
    range: { kind: "dateRange", start: "2023-01-01", end: "2026-12-31", label: "year range", scopeLabel: "2023–2026" },
    results: [{
      area: "salesArea",
      areaBreakdown: [
        { township: "Thaton", stateRegion: "Mon", units: 95, salesValue: 400 },
        { township: "Bilin", stateRegion: "Mon", units: 47, salesValue: 1_000 },
        { township: "Mudon", stateRegion: "Mon", units: 42, salesValue: 200 },
      ],
      coverageEnd: "2026-06-29",
      unresolvedUnits: 3,
    }],
  });
  assert.match(answer, /อันดับพื้นที่ขายระดับ Township/);
  assert.match(answer, /1\. Thaton \(Mon\): 95 คัน/);
  assert.match(answer, /2\. Bilin \(Mon\): 47 คัน/);
  assert.match(answer, /มีข้อมูลเพียง 3 พื้นที่/);
  assert.match(answer, /ข้อมูล Heatmap ล่าสุด: 2026-06-29/);
  assert.match(answer, /3 คันที่ยังจับคู่ Township ไม่ได้/);
  assert.match(answer, /แหล่งข้อมูล: KMM Sales Heatmap/);
  assert.doesNotMatch(answer, /ผลลัพธ์คือ -3/);
});

test("KAI explains consecutive Township declines using same-period annual comparisons", () => {
  const message = "Township ไหนที่ยอดขายลดลงเรื่อยๆ จากปี 2023-2026";
  assert.equal(isKmmBusinessQuestion(message), true);
  const answer = formatBusinessAnswer(message, {
    source: "KMM Internal Data",
    range: { kind: "dateRange", start: "2023-01-01", end: "2026-12-31", label: "year range", scopeLabel: "2023–2026" },
    results: [{
      area: "salesArea",
      annualAreas: [
        { township: "Thaton", stateRegion: "Mon", yearly: [
          { year: 2023, units: 10, salesValue: 1_000 },
          { year: 2024, units: 8, salesValue: 800 },
          { year: 2025, units: 5, salesValue: 500 },
          { year: 2026, units: 2, salesValue: 200 },
        ] },
        { township: "Bilin", stateRegion: "Mon", yearly: [
          { year: 2023, units: 2, salesValue: 200 },
          { year: 2024, units: 4, salesValue: 400 },
          { year: 2025, units: 3, salesValue: 300 },
          { year: 2026, units: 1, salesValue: 100 },
        ] },
      ],
      samePeriodThrough: "06-30",
      coverageEnd: "2026-06-30",
      trendUnresolvedUnits: 2,
    }],
  });
  assert.match(answer, /Township ที่Sales Unitลดลงต่อเนื่องทุกปี/);
  assert.match(answer, /1\. Thaton \(Mon\): 2023 10 → 2024 8 → 2025 5 → 2026 2 คัน/);
  assert.doesNotMatch(answer, /Bilin/);
  assert.match(answer, /วิธีเทียบ: 01-01 ถึง 06-30 ของทุกปี/);
  assert.match(answer, /2 คันในช่วงเทียบที่ยังจับคู่ Township ไม่ได้/);
});
