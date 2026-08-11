-- KAI Phase 1E: Knowledge Layer tables for the OPERATIONS_DB D1.
-- This migration is additive and does not change existing operational tables.

CREATE TABLE IF NOT EXISTS `kai_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metric_code` text NOT NULL,
	`metric_name` text NOT NULL,
	`description` text NOT NULL,
	`formula` text NOT NULL,
	`data_source` text NOT NULL,
	`unit_type` text NOT NULL,
	`business_rule` text NOT NULL,
	`ai_usage` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `kai_metrics_metric_code_unique` UNIQUE(`metric_code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kai_data_dictionary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_name` text NOT NULL,
	`table_name` text NOT NULL,
	`field_name` text NOT NULL,
	`data_type` text NOT NULL,
	`description` text NOT NULL,
	`domain` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kai_question_library` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`intent` text NOT NULL,
	`domain` text NOT NULL,
	`required_metric` text NOT NULL,
	`response_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kai_query_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`intent` text NOT NULL,
	`purpose` text NOT NULL,
	`required_data` text NOT NULL,
	`query_logic` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `kai_query_templates_intent_unique` UNIQUE(`intent`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kai_response_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`intent` text NOT NULL,
	`response_structure` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `kai_response_templates_intent_unique` UNIQUE(`intent`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kai_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_question` text NOT NULL,
	`intent` text NOT NULL,
	`answer` text NOT NULL,
	`feedback` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `kai_data_dictionary_mapping_unique`
	ON `kai_data_dictionary` (`business_name`, `table_name`, `field_name`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `kai_question_library_question_unique`
	ON `kai_question_library` (`question`, `intent`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `kai_data_dictionary_domain_idx`
	ON `kai_data_dictionary` (`domain`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `kai_question_library_intent_idx`
	ON `kai_question_library` (`intent`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `kai_history_created_at_idx`
	ON `kai_history` (`created_at`);
