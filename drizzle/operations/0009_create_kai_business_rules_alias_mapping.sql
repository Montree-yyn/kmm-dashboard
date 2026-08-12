CREATE TABLE IF NOT EXISTS `kai_business_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_code` text NOT NULL,
	`rule_name` text NOT NULL,
	`condition` text NOT NULL,
	`severity` text NOT NULL,
	`action` text NOT NULL,
	`domain` text NOT NULL,
	CONSTRAINT `kai_business_rules_rule_code_unique` UNIQUE(`rule_code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kai_alias_mapping` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alias_word` text NOT NULL,
	`canonical_term` text NOT NULL,
	`intent` text NOT NULL,
	`domain` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `kai_alias_mapping_unique_term`
	ON `kai_alias_mapping` (`alias_word`, `canonical_term`, `intent`, `domain`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `kai_alias_mapping_domain_idx`
	ON `kai_alias_mapping` (`domain`);
