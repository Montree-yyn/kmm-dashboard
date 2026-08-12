CREATE TABLE `sales_transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `company_id` text NOT NULL,
  `import_id` text NOT NULL,
  `import_year` integer NOT NULL,
  `import_month` integer NOT NULL,
  `sale_date` text NOT NULL,
  `invoice_no` text NOT NULL,
  `branch` text NOT NULL,
  `model_code` text NOT NULL,
  `employee_code` text DEFAULT '' NOT NULL,
  `quantity` integer NOT NULL,
  `sale_amount` text NOT NULL,
  `product_type` text,
  `model` text,
  `final_received` text,
  `net_received` text,
  `gp1` text,
  `expense` text,
  `salesperson_code` text,
  `salesperson_name` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sales_scope_invoice_idx` ON `sales_transactions` (`company_id`, `import_year`, `import_month`, `invoice_no`);
