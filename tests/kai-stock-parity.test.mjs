import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { isExecutiveQuestion, isKmmBusinessQuestion, summarizeKmmStockRows } = await tsImport("../lib/kai/tools/kmm-business.ts", import.meta.url);

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
