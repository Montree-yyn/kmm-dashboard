CREATE TABLE `business_targets` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `company_id` text NOT NULL,
  `target_year` integer NOT NULL,
  `target_month` integer NOT NULL,
  `metric` text NOT NULL,
  `target_value` text NOT NULL,
  `product_group` text DEFAULT '' NOT NULL,
  `branch_id` text DEFAULT '' NOT NULL,
  `salesperson_id` text DEFAULT '' NOT NULL,
  `source` text NOT NULL,
  `source_version` text NOT NULL,
  `approval_status` text DEFAULT 'approved' NOT NULL,
  `effective_from` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_targets_exact_version_unique` ON `business_targets` (`company_id`, `target_year`, `target_month`, `metric`, `product_group`, `branch_id`, `salesperson_id`, `source_version`);
--> statement-breakpoint
CREATE INDEX `business_targets_runtime_lookup_idx` ON `business_targets` (`company_id`, `target_year`, `target_month`, `metric`, `product_group`, `branch_id`, `salesperson_id`, `approval_status`, `effective_from`);
