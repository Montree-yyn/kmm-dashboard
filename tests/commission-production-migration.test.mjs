import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const bootstrapMigrations = ["0000_operations_import_metadata.sql", "0001_operations_sales.sql", "0002_operations_salespeople.sql", "0003_operations_booking.sql", "0004_operations_stock.sql", "0005_operations_daily_management.sql", "0006_operations_targets.sql"];
const historicalCodes = ["MM150701", "MM150807", "MM170309", "MM190905", "MM220404", "MM220407", "MM230802", "MM250602"];

function sql(database, statement) {
  return execFileSync("sqlite3", ["-json", database], {
    encoding: "utf8",
    input: statement,
  });
}

test("production Commission migration upgrades a 0000-0006 schema without KAI migrations", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kmm-commission-prod-"));
  const database = path.join(directory, "operations.sqlite");
  try {
    for (const migration of bootstrapMigrations) {
      sql(database, readFileSync(path.join(repoRoot, "drizzle/operations", migration), "utf8"));
    }
    const before = JSON.parse(sql(database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE name LIKE 'kai_%' OR name IN ('salesperson_identity_aliases')") || "[]");
    assert.deepEqual(before, [{ count: 0 }]);
    sql(database, readFileSync(path.join(repoRoot, "drizzle/production-commission/0001_commission_prod_001.sql"), "utf8"));
    const commissionColumn = JSON.parse(sql(database, "SELECT name, type FROM pragma_table_info('sales_transactions') WHERE name = 'commission'") || "[]");
    assert.deepEqual(commissionColumn, [{ name: "commission", type: "TEXT" }]);
    assert.deepEqual(JSON.parse(sql(database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'salesperson_identity_aliases'") || "[]"), [{ count: 1 }]);
    assert.deepEqual(JSON.parse(sql(database, "SELECT employee_code AS code, status FROM salesperson_master WHERE employee_code IN ('MM150701','MM150807','MM170309','MM190905','MM220404','MM220407','MM230802','MM250602') ORDER BY employee_code") || "[]"), historicalCodes.map((code) => ({ code, status: "inactive" })));
    assert.deepEqual(JSON.parse(sql(database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE name LIKE 'kai_%'") || "[]"), [{ count: 0 }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
