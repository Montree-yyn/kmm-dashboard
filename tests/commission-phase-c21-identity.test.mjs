import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const identity = await tsImport("../lib/sales/commission-identity.ts", import.meta.url);
const employees = [
  { employeeCode: "MM240503", salespersonCode: "MM240503", salespersonName: "U Ye Htet" },
  { employeeCode: "MM220406", salespersonCode: "MM220406", salespersonName: "Htet Lin Aung" },
];
const alias = { sourceSalespersonCode: null, sourceEmployeeCode: null, sourceSalespersonName: "01-Ye Htet", sourceBranch: "KMM01", canonicalEmployeeCode: "MM240503", canonicalSalespersonCode: "MM240503" };

function operationsDb() {
  const directory = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(directory)) return null;
  return readdirSync(directory).filter((name) => name.endsWith(".sqlite")).map((name) => path.join(directory, name)).find((database) => {
    try { return JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'kai_metrics'"], { encoding: "utf8" }))[0]?.count === 1; } catch { return false; }
  }) ?? null;
}

test("C2.1 resolves exact salesperson code and employee code only when a unique Master row exists", () => {
  const bySalesperson = identity.resolveCommissionIdentity({ salespersonCode: "MM240503" }, employees);
  const byEmployee = identity.resolveCommissionIdentity({ employeeCode: "MM220406" }, employees);
  assert.equal(bySalesperson?.source, "salesperson_code");
  assert.equal(byEmployee?.source, "employee_code");
  assert.equal(bySalesperson?.key, "employee_code:MM240503");
  assert.equal(byEmployee?.key, "employee_code:MM220406");
  assert.equal(identity.resolveCommissionIdentity({ salespersonCode: "UNKNOWN" }, employees), null);
  assert.equal(identity.resolveCommissionIdentity({ employeeCode: "UNKNOWN" }, employees), null);
});

test("C2.1 permits the controlled legacy alias only for its exact no-code KMM01 source identity", () => {
  const resolved = identity.resolveCommissionIdentity({ salespersonName: "01-Ye Htet", branch: "KMM01" }, employees, [alias]);
  assert.deepEqual(resolved, { key: "employee_code:MM240503", salespersonCode: "MM240503", employeeCode: "MM240503", name: "U Ye Htet", source: "controlled_legacy_alias" });
  assert.equal(identity.resolveCommissionIdentity({ salespersonName: "01-Ye Htet", branch: "KMM03" }, employees, [alias]), null);
  assert.equal(identity.resolveCommissionIdentity({ salespersonName: "Ye Htet", branch: "KMM01" }, employees, [alias]), null);
  assert.equal(identity.resolveCommissionIdentity({ salespersonName: "01-Ye Htet", salespersonCode: "UNKNOWN", branch: "KMM01" }, employees, [alias]), null);
});

test("C3.2D groups an approved coded alias with its canonical master identity", () => {
  const canonical = identity.resolveCommissionIdentity({ employeeCode: "MM220406" }, employees);
  const aliasRow = identity.resolveCommissionIdentity({ employeeCode: "MM230406", salespersonName: "03-Lin Aung", branch: "KMM03" }, employees, [{
    sourceSalespersonCode: null,
    sourceEmployeeCode: "MM230406",
    sourceSalespersonName: "03-Lin Aung",
    sourceBranch: "KMM03",
    canonicalEmployeeCode: "MM220406",
    canonicalSalespersonCode: "MM220406",
  }]);
  assert.equal(canonical?.key, "employee_code:MM220406");
  assert.equal(aliasRow?.key, canonical?.key);
});

test("C2.1 rejects ambiguous aliases and never uses fuzzy display-name matching", () => {
  assert.equal(identity.resolveCommissionIdentity({ salespersonName: "01-Ye Htet", branch: "KMM01" }, employees, [alias, { ...alias, canonicalEmployeeCode: "MM220406", canonicalSalespersonCode: "MM220406" }]), null);
  assert.equal(identity.resolveCommissionIdentity({ salespersonName: "U Ye" }, employees), null);
});

test("C2.2 treats (Out) as a status marker and never uses a name-only identity match", () => {
  assert.equal(identity.resolveCommissionIdentity({ salespersonName: "Aung Aung" }, [{ employeeCode: "CURRENT", salespersonCode: "CURRENT", salespersonName: "Aung Aung" }]), null);
  assert.equal(identity.resolveCommissionIdentity({ salespersonName: "Aung Aung (Out)" }, [{ employeeCode: "CURRENT", salespersonCode: "CURRENT", salespersonName: "Aung Aung" }]), null);
  assert.equal(identity.resolveCommissionIdentity({ salespersonName: "01-Ye Htet (Out)", branch: "KMM01" }, employees, [alias]), null);
});

test("C2.1 Local alias migration and reconciler remain explicit, company-scoped, and no-op by default", () => {
  const migration = readFileSync(path.join(repoRoot, "drizzle/operations/0022_create_salesperson_identity_aliases.sql"), "utf8");
  const script = readFileSync(path.join(repoRoot, "scripts/reconcile-local-salesperson-identity.mjs"), "utf8");
  assert.match(migration, /salesperson_identity_aliases/);
  assert.match(migration, /company_id/);
  assert.match(script, /--apply/);
  assert.match(script, /MM240503/);
  assert.match(script, /01-Ye Htet/);
});

test("C2.1 Local D1 preserves financial totals while the approved alias resolves the positive risk", { skip: !operationsDb() }, () => {
  const database = operationsDb();
  const output = execFileSync("node", ["scripts/reconcile-local-salesperson-identity.mjs"], { cwd: repoRoot, encoding: "utf8" });
  assert.match(output, /"storedAliases": 1/);
  const result = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT SUM(CAST(commission AS REAL)) AS total, COUNT(*) AS rows FROM sales_transactions WHERE company_id = 'kmm-company'"], { encoding: "utf8" }))[0];
  assert.deepEqual(result, { total: 341705800, rows: 3417 });
});
