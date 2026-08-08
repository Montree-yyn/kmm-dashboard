CREATE TABLE `salesperson_master` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`employee_code` text NOT NULL,
	`salesperson_code` text NOT NULL,
	`salesperson_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `salesperson_master_employee_unique` ON `salesperson_master` (`company_id`,`employee_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `salesperson_master_code_unique` ON `salesperson_master` (`company_id`,`salesperson_code`);