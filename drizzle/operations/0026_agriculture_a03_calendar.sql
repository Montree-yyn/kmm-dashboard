-- Agriculture A03: source, baseline calendar, estimate, and adjustment records.
CREATE TABLE IF NOT EXISTS `agri_sources` (
  `source_id` text PRIMARY KEY NOT NULL,
  `source_name` text NOT NULL,
  `source_type` text NOT NULL,
  `publisher` text,
  `publication_date` text,
  `source_geography` text,
  `reference_uri` text,
  `reliability_grade` text DEFAULT 'UNKNOWN' NOT NULL,
  `notes` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_sources_geography_idx` ON `agri_sources` (`source_geography`, `publication_date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_crop_calendars` (
  `calendar_record_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `crop_id` text NOT NULL,
  `season_id` text,
  `crop_year` integer,
  `stage_code` text NOT NULL,
  `baseline_start_date` text,
  `baseline_end_date` text,
  `source_geography` text,
  `source_id` text,
  `source_publication_date` text,
  `verification_level` text DEFAULT 'V0' NOT NULL,
  `confidence_score` integer,
  `inherited_from_location_id` text,
  `weather_adjusted` integer DEFAULT 0 NOT NULL,
  `calendar_shift_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `calendar_shift_days` integer,
  `local_verified` integer DEFAULT 0 NOT NULL,
  `verified_by` text,
  `verified_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_calendars_location_year_idx` ON `agri_crop_calendars` (`location_id`, `crop_year`, `crop_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_calendars_verification_idx` ON `agri_crop_calendars` (`verification_level`, `confidence_score`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_calendar_estimates` (
  `estimate_id` text PRIMARY KEY NOT NULL,
  `calendar_record_id` text NOT NULL,
  `estimated_start_date` text,
  `estimated_end_date` text,
  `source_geography` text,
  `source_id` text,
  `source_publication_date` text,
  `verification_level` text DEFAULT 'V0' NOT NULL,
  `confidence_score` integer,
  `weather_adjusted` integer DEFAULT 0 NOT NULL,
  `calendar_shift_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `calendar_shift_days` integer,
  `notes` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_calendar_estimates_calendar_idx` ON `agri_calendar_estimates` (`calendar_record_id`, `verification_level`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_calendar_adjustments` (
  `adjustment_id` text PRIMARY KEY NOT NULL,
  `calendar_record_id` text NOT NULL,
  `weather_state_id` text,
  `adjustment_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `shift_days` integer,
  `reason_codes` text DEFAULT '[]' NOT NULL,
  `source_id` text,
  `model_version` text,
  `applied_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_calendar_adjustments_calendar_idx` ON `agri_calendar_adjustments` (`calendar_record_id`, `adjustment_status`);
