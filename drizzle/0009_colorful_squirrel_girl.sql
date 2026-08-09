CREATE TABLE `daily_management_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`report_date` text NOT NULL,
	`branch` text NOT NULL,
	`draft_payload` text NOT NULL,
	`published_payload` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`saved_at` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_management_inputs_scope_unique` ON `daily_management_inputs` (`company_id`,`report_date`,`branch`);--> statement-breakpoint
CREATE INDEX `daily_management_inputs_latest_idx` ON `daily_management_inputs` (`company_id`,`updated_at`);