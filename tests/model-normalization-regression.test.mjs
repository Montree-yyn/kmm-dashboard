import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const normalization = await tsImport("../lib/dashboard/model-normalization.ts", import.meta.url);
const operations = await tsImport("../lib/operations/adapters.ts", import.meta.url);
const sales = await tsImport("../lib/sales/compatibility-adapter.ts", import.meta.url);

test("DC70G PRO aliases resolve to one canonical KMM model", () => {
  for (const value of ["DC70G PRO", "DC-70G PRO", "dc 70g-pro", " DC–70G   PRO "]) {
    assert.equal(normalization.canonicalModelName(value), "DC70G PRO");
  }
  assert.equal(normalization.canonicalModelName("DC-70G Plus"), "DC-70G Plus");
});

test("Sales, Booking and Stock adapters canonicalize the model before dashboard use", () => {
  assert.equal(operations.adaptBookingRow({ productModel: "DC-70G PRO" }).model, "DC70G PRO");
  assert.equal(operations.adaptStockRow({ productModel: "DC-70G PRO" }).model, "DC70G PRO");
  const row = sales.toCanonicalSalesRow({
    id: "1", saleDate: "2026-08-09", importYear: 2026, importMonth: 8,
    branch: "KMM01", modelCode: "DC-70G PRO", employeeCode: "E1", quantity: 1,
    saleAmount: "0", productType: "02-CH", model: "DC-70G PRO", finalReceived: null,
    netReceived: null, gp1: null, expense: null, salespersonCode: null, salespersonName: null,
  });
  assert.equal(row.model, "DC70G PRO");
  assert.equal(row.modelCode, "DC70G PRO");
});

test("Bundled dashboard fallbacks contain no legacy DC-70G PRO label", async () => {
  const [dashboard, realData] = await Promise.all([
    readFile(new URL("../public/dashboard-data.json", import.meta.url), "utf8"),
    readFile(new URL("../public/kmm-real-data.json", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(dashboard, /DC-70G PRO/);
  assert.doesNotMatch(realData, /DC-70G PRO/);
  assert.match(dashboard, /DC70G PRO/);
});
