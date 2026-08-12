CREATE TABLE `data_import_history` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `company_id` text NOT NULL,
  `module` text NOT NULL,
  `import_year` integer NOT NULL,
  `import_month` integer NOT NULL,
  `filename` text NOT NULL,
  `status` text NOT NULL,
  `total_rows` integer DEFAULT 0 NOT NULL,
  `valid_rows` integer DEFAULT 0 NOT NULL,
  `warning_rows` integer DEFAULT 0 NOT NULL,
  `error_rows` integer DEFAULT 0 NOT NULL,
  `duration_ms` integer DEFAULT 0 NOT NULL,
  `error_report` text,
  `imported_by` text NOT NULL,
  `imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `data_column_mappings` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `company_id` text NOT NULL,
  `module` text NOT NULL,
  `mapping` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_column_mappings_scope_unique` ON `data_column_mappings` (`company_id`, `module`);
