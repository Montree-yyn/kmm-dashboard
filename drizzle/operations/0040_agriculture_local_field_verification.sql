-- Agriculture Local Field Verification Pass #1.
-- Additive Local D1 fields only. Existing public/source records are never overwritten.

ALTER TABLE `agri_field_verifications` ADD COLUMN `crop_year` integer;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `season_code` text;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `crop_presence` text NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `importance` text NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `estimated_area` real;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `area_unit` text;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `area_quality` text NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `planting_start_month` integer;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `planting_end_month` integer;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `harvest_start_month` integer;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `harvest_end_month` integer;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `current_stage` text;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `irrigation_type` text NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `mechanization_level` text NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `common_machines` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `notes` text;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `verified_role` text;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `verification_method` text NOT NULL DEFAULT 'OTHER';
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `confidence_score` integer;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `reviewed_by` text;
--> statement-breakpoint
ALTER TABLE `agri_field_verifications` ADD COLUMN `reviewed_at` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_field_verifications_current_idx` ON `agri_field_verifications` (`location_id`, `crop_id`, `verification_level`, `status`, `verified_at`);
