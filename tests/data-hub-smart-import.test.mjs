import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Data Hub renders the approved Smart Import workspace", async () => {
  const [page, smartImport] = await Promise.all([
    read("components/data-hub/data-hub-page.tsx"),
    read("components/data-hub/smart-import-center.tsx"),
  ]);

  assert.match(page, /<SmartImportCenter\s*\/>/);
  assert.doesNotMatch(page, /return <UnifiedImportCenter\s*\/>/);
  assert.match(smartImport, /t\("dataHub\.smartImportDescription"\)/);
  assert.match(smartImport, /t\("dataHub\.drop"\)/);
  assert.match(smartImport, /Auto detect \(recommended\)/);
  assert.match(smartImport, /Confirm uploaded file type/);
  for (const moduleId of ["sales", "booking", "stock"]) {
    assert.match(smartImport, new RegExp(`id: "${moduleId}"`));
  }
});

test("Smart Import detects first and lets the user override the file type", async () => {
  const smartImport = await read("components/data-hub/smart-import-center.tsx");

  assert.match(smartImport, /parseSpreadsheetFile\(file, requestedModule \? \{ module: requestedModule \} : \{\}\)/);
  assert.match(smartImport, /isImportModule\(detectedFile\.detection\?\.module\.value\)/);
  assert.match(smartImport, /setAutoDetected\(!requestedModule\)/);
  assert.match(smartImport, /handleTypeChange/);
  assert.match(smartImport, /processFile\(file, value\)/);
  assert.match(smartImport, /Auto-detected:/);
});

test("Smart Import preserves validation, accessible upload and the governed import service", async () => {
  const smartImport = await read("components/data-hub/smart-import-center.tsx");

  assert.match(smartImport, /createColumnMappings/);
  assert.match(smartImport, /applyColumnMappings/);
  assert.match(smartImport, /validateImportRows/);
  assert.match(smartImport, /completeUnifiedModuleImport/);
  assert.match(smartImport, /role="button"/);
  assert.match(smartImport, /tabIndex=\{0\}/);
  assert.match(smartImport, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(smartImport, /aria-label="Validation summary"/);
  assert.match(smartImport, /role="alert"/);
  assert.match(smartImport, /Approve &amp; import/);
});

test("Smart Import keeps history secondary and avoids horizontal data tables", async () => {
  const smartImport = await read("components/data-hub/smart-import-center.tsx");

  assert.match(smartImport, /<details className="group/);
  assert.match(smartImport, /Import history/);
  assert.match(smartImport, /table-fixed/);
  assert.doesNotMatch(smartImport, /overflow-x-auto/);
  assert.doesNotMatch(smartImport, /Import All preflight/);
});
