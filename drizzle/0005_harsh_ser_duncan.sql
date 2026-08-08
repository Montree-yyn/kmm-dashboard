CREATE TABLE `booking_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`import_id` text NOT NULL,
	`import_year` integer NOT NULL,
	`import_month` integer NOT NULL,
	`business_week` integer,
	`booking_date` text NOT NULL,
	`booking_no` text NOT NULL,
	`branch` text NOT NULL,
	`customer` text NOT NULL,
	`product` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_id` text NOT NULL,
	`import_id` text NOT NULL,
	`import_year` integer NOT NULL,
	`import_month` integer NOT NULL,
	`business_week` integer,
	`as_of_date` text NOT NULL,
	`branch` text NOT NULL,
	`product` text NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL
);
