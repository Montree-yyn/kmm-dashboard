CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`ip_address` text,
	`device` text,
	`status` text DEFAULT 'recorded' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`branch_name` text NOT NULL,
	`branch_code` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`township` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`manager` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`latitude` text DEFAULT '' NOT NULL,
	`longitude` text DEFAULT '' NOT NULL,
	`time_zone` text DEFAULT 'Asia/Yangon' NOT NULL,
	`users` integer DEFAULT 0 NOT NULL,
	`has_transactions` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branches_company_code_unique` ON `branches` (`company_id`,`branch_code`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`company_name` text NOT NULL,
	`company_code` text NOT NULL,
	`legal_name` text DEFAULT '' NOT NULL,
	`logo_url` text DEFAULT '' NOT NULL,
	`tax_id` text DEFAULT '' NOT NULL,
	`registration_number` text DEFAULT '' NOT NULL,
	`business_type` text DEFAULT '' NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`established_year` integer,
	`website` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_company_code_unique` ON `companies` (`company_code`);--> statement-breakpoint
CREATE TABLE `company_currencies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`primary_currency` text DEFAULT 'MMK' NOT NULL,
	`display_currency` text DEFAULT 'MMK' NOT NULL,
	`currency_symbol` text DEFAULT 'K' NOT NULL,
	`decimal_places` integer DEFAULT 0 NOT NULL,
	`number_format` text DEFAULT '1,234.56' NOT NULL,
	`negative_number_format` text DEFAULT '-1,234.56' NOT NULL,
	`exchange_rate_source` text DEFAULT 'manual' NOT NULL,
	`manual_exchange_rate` text DEFAULT '1' NOT NULL,
	`last_rate_update` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_localizations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`default_language` text DEFAULT 'en' NOT NULL,
	`fallback_language` text DEFAULT 'th' NOT NULL,
	`default_time_zone` text DEFAULT 'Asia/Yangon' NOT NULL,
	`date_format` text DEFAULT 'DD/MM/YYYY' NOT NULL,
	`time_format` text DEFAULT '24-hour' NOT NULL,
	`first_day_of_week` text DEFAULT 'Monday' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_setting_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_setting_drafts_company_id_unique` ON `company_setting_drafts` (`company_id`);--> statement-breakpoint
CREATE TABLE `company_users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_users_company_user_unique` ON `company_users` (`company_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`department_name` text NOT NULL,
	`department_code` text NOT NULL,
	`branch_id` text DEFAULT '' NOT NULL,
	`head` text DEFAULT '' NOT NULL,
	`users` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_company_code_unique` ON `departments` (`company_id`,`department_code`);--> statement-breakpoint
CREATE TABLE `fiscal_years` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`fiscal_year_name` text NOT NULL,
	`start_month` integer NOT NULL,
	`start_day` integer NOT NULL,
	`end_month` integer NOT NULL,
	`end_day` integer NOT NULL,
	`current_fiscal_year` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`branch_id` text DEFAULT '' NOT NULL,
	`holiday_name` text NOT NULL,
	`holiday_date` text NOT NULL,
	`repeat_annually` integer DEFAULT false NOT NULL,
	`holiday_type` text DEFAULT 'company' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `working_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`working_days` text DEFAULT '[]' NOT NULL,
	`weekend_days` text DEFAULT '[]' NOT NULL,
	`working_start_time` text DEFAULT '08:00' NOT NULL,
	`working_end_time` text DEFAULT '17:00' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
