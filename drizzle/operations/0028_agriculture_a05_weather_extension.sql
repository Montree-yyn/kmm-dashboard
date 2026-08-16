-- Agriculture A05: crop-weather rule/state and future climatology/anomaly structures.
CREATE TABLE IF NOT EXISTS `agri_crop_weather_rules` (
  `rule_id` text PRIMARY KEY NOT NULL,
  `crop_id` text NOT NULL,
  `stage_code` text NOT NULL,
  `weather_variable` text NOT NULL,
  `rule_type` text NOT NULL,
  `warning_min` text,
  `warning_max` text,
  `critical_min` text,
  `critical_max` text,
  `unit` text,
  `risk_type` text,
  `direction` text,
  `source_id` text,
  `source_geography` text,
  `source_version` text,
  `confidence_grade` text DEFAULT 'UNKNOWN' NOT NULL,
  `local_calibrated` integer DEFAULT 0 NOT NULL,
  `calibration_location` text,
  `calibration_year` integer,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_weather_rules_lookup_idx` ON `agri_crop_weather_rules` (`crop_id`, `stage_code`, `weather_variable`, `is_active`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_crop_weather_state` (
  `state_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `crop_id` text NOT NULL,
  `stage_code` text NOT NULL,
  `weather_variable` text NOT NULL,
  `observed_value` text,
  `unit` text,
  `risk_type` text,
  `state_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `source` text,
  `provider` text,
  `retrieved_at` text,
  `quality_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `calculated_at` text,
  `reason_codes` text DEFAULT '[]' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_weather_state_lookup_idx` ON `agri_crop_weather_state` (`location_id`, `crop_id`, `stage_code`, `weather_variable`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `weather_climatology` (
  `climatology_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `variable` text NOT NULL,
  `period_start_month` integer,
  `period_end_month` integer,
  `normal_value` text,
  `unit` text,
  `source_id` text,
  `source_geography` text,
  `source_year` integer,
  `confidence_grade` text DEFAULT 'UNKNOWN' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `weather_climatology_lookup_idx` ON `weather_climatology` (`location_id`, `variable`, `source_year`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `weather_anomalies` (
  `anomaly_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `variable` text NOT NULL,
  `period_start` text,
  `period_end` text,
  `observed_value` text,
  `normal_value` text,
  `anomaly_value` text,
  `unit` text,
  `source_id` text,
  `confidence_grade` text DEFAULT 'UNKNOWN' NOT NULL,
  `calculated_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `weather_anomalies_lookup_idx` ON `weather_anomalies` (`location_id`, `variable`, `period_end`);
