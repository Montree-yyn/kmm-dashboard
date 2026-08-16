-- OPERATIONS_DB index for the highest-volume table (sales_transactions).
-- Performance audit F2 (see reports/KMM_PERFORMANCE_AUDIT_REPORT.md P0-4):
-- lib/sales/repository.ts -> listSalesTransactions filters by company_id and
-- orders by sale_date, but the only index (sales_scope_invoice_idx) covers
-- (company_id, import_year, import_month, invoice_no) -> SQLite still needs a
-- TEMP B-TREE to satisfy ORDER BY sale_date. This compound index serves both
-- the WHERE and the ORDER BY from the index itself (no sort step).
--
-- Re-import deletes by (company_id, import_year, import_month) are already
-- covered by sales_scope_invoice_idx (import columns are its leading prefix),
-- so no separate import index is needed for sales.
--
-- Additive only (IF NOT EXISTS): no table or data change.
--
-- Rollback (reverse migration):
--   DROP INDEX IF EXISTS `sales_transactions_company_date_idx`;

CREATE INDEX IF NOT EXISTS `sales_transactions_company_date_idx`
  ON `sales_transactions` (`company_id`, `sale_date`);

