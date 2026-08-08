import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Sprint 2.3 exposes exactly the Sales, Booking and Stock Import Center cards", () => {
  const page = read("components/data-hub/unified-import-center.tsx");
  for (const importModule of ["sales", "booking", "stock"]) assert.match(page, new RegExp(`id: "${importModule}"`));
  assert.match(page, /Drag & Drop/);
  assert.match(page, /Browse File/);
  assert.match(page, /Import All/);
  assert.match(page, /Latest Updates/);
  assert.match(page, /Import History/);
  assert.match(page, /Company KMM/);
  assert.doesNotMatch(page, /Company selector/);
});

test("Import All runs modules in order, continues after failures, and emits one refresh", () => {
  const page = read("components/data-hub/unified-import-center.tsx");
  assert.match(page, /for \(const \{ id \} of modules\)/);
  assert.match(page, /catch \(error\) \{\s*failed\.push\(id\);/);
  assert.match(page, /completeUnifiedModuleImport\(\{ module, file: state\.mappedFile/);
  assert.match(page, /importOne\(id, false\)/);
  assert.match(page, /successful\.length && typeof window !== "undefined"/);
  assert.match(page, /new CustomEvent\("kmm:sales-imported"/);
});

test("Import Center projects the existing module state into the guided workflow", () => {
  const page = read("components/data-hub/unified-import-center.tsx");
  for (const step of ["Upload", "Preview", "Validation", "Approval", "Import", "Dashboard Update", "Completed"]) {
    assert.match(page, new RegExp(`"${step}"`));
  }
  assert.match(page, /currentWorkflowStep/);
  assert.match(page, /aria-current=\{active \? "step"/);
  assert.match(page, /Current step:/);
  assert.match(page, /ImportAllPreflight/);
  assert.match(page, /Ready/);
  assert.match(page, /Warning/);
  assert.match(page, /Blocked/);
  assert.match(page, /Missing/);
});

test("Import Center exposes mapping, validation, progress, and accessible upload states", () => {
  const page = read("components/data-hub/unified-import-center.tsx");
  for (const label of ["Mapped", "Ignored", "Missing", "Warnings", "Valid", "Errors", "Duplicates"]) assert.match(page, new RegExp(label));
  assert.match(page, /role="button"/);
  assert.match(page, /tabIndex=\{0\}/);
  assert.match(page, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(page, /role="progressbar"/);
  assert.match(page, /Import All in progress/);
  assert.match(page, /Open Dashboard/);
  assert.match(page, /role=\{hasErrors \? "alert" : "status"\}/);
});

test("Import History keeps filters, progressive disclosure, and failure details presentation-only", () => {
  const page = read("components/data-hub/unified-import-center.tsx");
  assert.match(page, /Filter import history by module/);
  assert.match(page, /Filter import history by status/);
  assert.match(page, /Filter import history by date/);
  assert.match(page, /Show more history/);
  assert.match(page, /Failure details:/);
  assert.match(page, /record\.failureReason/);
});

test("Booking and Stock use persisted D1 tables and shared import history", () => {
  const route = read("app/api/data-hub/import/route.ts");
  const schema = read("db/schema.ts");
  assert.match(route, /bookingTransactions/);
  assert.match(route, /stockTransactions/);
  assert.match(route, /dataImportHistory/);
  assert.match(route, /statuses/);
  assert.match(schema, /export const bookingTransactions/);
  assert.match(schema, /export const stockTransactions/);
  assert.match(read("drizzle/0005_harsh_ser_duncan.sql"), /CREATE TABLE `booking_transactions`/);
  assert.match(read("drizzle/0005_harsh_ser_duncan.sql"), /CREATE TABLE `stock_transactions`/);
});

test("Sales remains behind the existing API boundary and can suppress per-module refresh", () => {
  const service = read("lib/data-hub/import-service.ts");
  const unified = read("lib/data-hub/unified-import-service.ts");
  assert.match(service, /emitRefresh\?: boolean/);
  assert.match(service, /emitRefresh && typeof window/);
  assert.match(unified, /completeSessionImport/);
  assert.match(unified, /module === "sales"/);
});
