-- OPERATIONS_DB indexes for the two highest-volume operational tables.
-- Roadmap task 1.2: every read filters by company_id and orders by date
-- (lib/operations/repository.ts -> /api/operations, /api/daily-management,
-- KAI executive-intelligence / kmm-business), and the Data Hub re-import
-- deletes by (company_id, import_year, import_month)
-- (app/api/data-hub/import/route.ts). All statements are additive
-- (IF NOT EXISTS): no table or data change.
--
-- Rollback (reverse migration):
--   DROP INDEX IF EXISTS `booking_transactions_company_date_idx`;
--   DROP INDEX IF EXISTS `stock_transactions_company_date_idx`;
--   DROP INDEX IF EXISTS `booking_transactions_company_import_idx`;
--   DROP INDEX IF EXISTS `stock_transactions_company_import_idx`;
--
-- Topology decision (task 1.2, ties to audit finding A1/F1):
-- `drizzle/0005_harsh_ser_duncan.sql` (COMPANY_DB lineage) also creates
-- tables named booking_transactions / stock_transactions with base columns
-- only. Those are separate D1 databases; this migration targets OPERATIONS_DB
-- (getOperationsDb) exclusively, which is the only database the application
-- reads these tables from. We deliberately do NOT mirror the index DDL into
-- the COMPANY_DB lineage here: that lineage's copies are stale (they predate
-- the column additions in drizzle/0006+), and whether that lineage is still
-- applied anywhere is unresolved (A1/F1). Mirroring DDL now would freeze the
-- drift. The Phase 2 migration reconcile decides the fate of the duplicate
-- lineage and adds matching indexes there only if it survives.

CREATE INDEX IF NOT EXISTS `booking_transactions_company_date_idx`
  ON `booking_transactions` (`company_id`, `booking_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `stock_transactions_company_date_idx`
  ON `stock_transactions` (`company_id`, `as_of_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `booking_transactions_company_import_idx`
  ON `booking_transactions` (`company_id`, `import_year`, `import_month`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `stock_transactions_company_import_idx`
  ON `stock_transactions` (`company_id`, `import_year`, `import_month`);
