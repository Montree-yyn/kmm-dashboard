DROP INDEX `sales_scope_invoice_unique`;--> statement-breakpoint
CREATE INDEX `sales_scope_invoice_idx` ON `sales_transactions` (`company_id`,`import_year`,`import_month`,`invoice_no`);