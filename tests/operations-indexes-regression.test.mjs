import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("operations index migration covers company-scoped reads and re-import deletes", async () => {
  const migration = await read("drizzle/operations/0041_operations_indexes.sql");
  // Reads: repository filters by company_id and orders by date.
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS `booking_transactions_company_date_idx`\s+ON `booking_transactions` \(`company_id`, `booking_date`\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS `stock_transactions_company_date_idx`\s+ON `stock_transactions` \(`company_id`, `as_of_date`\)/,
  );
  // Data Hub re-import deletes by company + import period.
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS `booking_transactions_company_import_idx`\s+ON `booking_transactions` \(`company_id`, `import_year`, `import_month`\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS `stock_transactions_company_import_idx`\s+ON `stock_transactions` \(`company_id`, `import_year`, `import_month`\)/,
  );
});

test("operations index migration is additive-only with rollback and the topology decision recorded", async () => {
  const migration = await read("drizzle/operations/0041_operations_indexes.sql");
  assert.doesNotMatch(migration, /DROP TABLE|ALTER TABLE|INSERT INTO|UPDATE /);
  // Rollback statements are documented in the migration.
  assert.match(migration, /DROP INDEX IF EXISTS `booking_transactions_company_date_idx`/);
  assert.match(migration, /DROP INDEX IF EXISTS `stock_transactions_company_import_idx`/);
  // The COMPANY_DB duplicate-lineage decision (A1/F1) is recorded.
  assert.match(migration, /drizzle\/0005_harsh_ser_duncan\.sql/);
  assert.match(migration, /A1\/F1/);
  assert.match(migration, /Phase 2 migration reconcile/);
});

test("operations index migration 0042 adds the sales company+date index (perf audit F2)", async () => {
  const migration = await read("drizzle/operations/0042_operations_sales_date_index.sql");
  // listSalesTransactions: WHERE company_id=? ORDER BY sale_date ASC.
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS `sales_transactions_company_date_idx`\s+ON `sales_transactions` \(`company_id`, `sale_date`\)/,
  );
  // Re-import deletes are covered by the leading prefix of sales_scope_invoice_idx.
  assert.match(migration, /sales_scope_invoice_idx/);
  // Rollback is documented.
  assert.match(migration, /DROP INDEX IF EXISTS `sales_transactions_company_date_idx`/);
});

test("operations index migration 0042 is additive-only", async () => {
  const migration = await read("drizzle/operations/0042_operations_sales_date_index.sql");
  assert.doesNotMatch(migration, /DROP TABLE|ALTER TABLE|INSERT INTO|UPDATE /);
  assert.doesNotMatch(migration, /statement-breakpoint/);
});

