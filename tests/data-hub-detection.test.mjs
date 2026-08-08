import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const salesSheet = (name = "Sales Data", rows = [{ company_code: "KMM", sale_date: "2026-08-12", invoice_no: "INV-1", branch: "Yangon", model_code: "M1", quantity: 1, sale_amount: 100 }]) => ({ name, headers: Object.keys(rows[0] ?? {}), rows, isSalesCandidate: true, salesScore: 6 });

test("detects KMM from workbook data and period from sales dates", async () => {
  const { detectImportMetadata } = await importTypeScriptModule("lib/data-hub/detect-import.ts");
  const result = detectImportMetadata({ filename: "upload.xlsx", sheets: [salesSheet()] });
  assert.deepEqual(result.company.value, "KMM");
  assert.equal(result.company.confidence, "high");
  assert.equal(result.module.value, "sales");
  assert.equal(result.year.value, 2026);
  assert.equal(result.month.value, 8);
  assert.match(result.company.evidence[0].detail, /company_code/);
});

test("uses sheet name and filename fallbacks for company", async () => {
  const { detectImportMetadata } = await importTypeScriptModule("lib/data-hub/detect-import.ts");
  const fromSheet = detectImportMetadata({ filename: "upload.xlsx", sheets: [salesSheet("KMM Sales", [{ sale_date: "2026-08-12", invoice_no: "INV-1", branch: "Yangon", model_code: "M1", quantity: 1, sale_amount: 100 }]) ] });
  const fromFilename = detectImportMetadata({ filename: "KM_sales_2026_aug.xlsx", sheets: [salesSheet("Transactions", [{ sale_date: "2026-08-12", invoice_no: "INV-1", branch: "Yangon", model_code: "M1", quantity: 1, sale_amount: 100 }]) ] });
  assert.equal(fromSheet.company.value, "KMM");
  assert.equal(fromSheet.company.confidence, "medium");
  assert.equal(fromFilename.company.value, "KM");
  assert.equal(fromFilename.company.confidence, "low");
});

test("flags low-confidence fallback and conflicting sheets while detecting unified modules", async () => {
  const { detectImportMetadata } = await importTypeScriptModule("lib/data-hub/detect-import.ts");
  const unknown = detectImportMetadata({ filename: "upload.xlsx", sheets: [salesSheet("Transactions", [{ sale_date: "2026-08-12", invoice_no: "INV-1", branch: "Yangon", model_code: "M1", quantity: 1, sale_amount: 100 }]) ] });
  const conflict = detectImportMetadata({ filename: "upload.xlsx", sheets: [salesSheet("Sales 1"), salesSheet("Sales 2")] });
  const stock = detectImportMetadata({ filename: "stock.xlsx", sheets: [{ name: "Stock", headers: ["as_of_date", "branch", "product", "quantity"], rows: [{ as_of_date: "2026-08-01", branch: "A", product: "P", quantity: 1 }], isSalesCandidate: false, salesScore: 0 }] });
  assert.equal(unknown.company.confidence, "unknown");
  assert.ok(conflict.warnings.some((warning) => /Multiple sheets/.test(warning)));
  assert.equal(stock.module.value, "stock");
  assert.ok(stock.warnings.every((warning) => !/Sales only/.test(warning)));
  const metadataConflict = detectImportMetadata({ filename: "upload.xlsx", metadata: { company: "KMM", company_code: "KM" }, sheets: [salesSheet()] });
  assert.ok(metadataConflict.warnings.some((warning) => /conflicting company/.test(warning)));
});
