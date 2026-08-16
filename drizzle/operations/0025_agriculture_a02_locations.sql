-- Agriculture A02: canonical pilot locations and evidence-safe crop presence.
CREATE TABLE IF NOT EXISTS `agri_locations` (
  `location_id` text PRIMARY KEY NOT NULL,
  `country_code` text NOT NULL,
  `state_region_code` text,
  `state_region_name` text,
  `district_code` text,
  `district_name` text,
  `township_code` text,
  `township_name` text,
  `canonical_name` text NOT NULL,
  `alternate_names` text DEFAULT '[]' NOT NULL,
  `myanmar_name` text,
  `latitude` text,
  `longitude` text,
  `admin_version` text NOT NULL,
  `source` text NOT NULL,
  `source_date` text,
  `kmm_branch_code` text,
  `sales_territory_id` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `valid_from` text,
  `valid_to` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agri_locations_country_canonical_unique` ON `agri_locations` (`country_code`, `canonical_name`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_locations_township_lookup_idx` ON `agri_locations` (`country_code`, `state_region_code`, `township_code`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_crop_locations` (
  `crop_location_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `crop_id` text NOT NULL,
  `presence_status` text NOT NULL,
  `importance_level` text NOT NULL,
  `evidence_geography` text,
  `evidence_year` integer,
  `source_id` text,
  `confidence_grade` text DEFAULT 'UNKNOWN' NOT NULL,
  `cultivated_area` text,
  `cultivated_area_unit` text,
  `cultivated_area_year` integer,
  `local_verified` integer DEFAULT 0 NOT NULL,
  `verified_by` text,
  `verified_at` text,
  `notes` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agri_crop_locations_scope_unique` ON `agri_crop_locations` (`location_id`, `crop_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_locations_presence_idx` ON `agri_crop_locations` (`location_id`, `presence_status`, `confidence_grade`);
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_locations` (`location_id`, `country_code`, `state_region_code`, `state_region_name`, `township_code`, `township_name`, `canonical_name`, `alternate_names`, `latitude`, `longitude`, `admin_version`, `source`, `source_date`, `kmm_branch_code`, `is_active`, `created_by`, `updated_by`) VALUES
  ('MM-BGO-THARRAWADDY', 'MM', 'BGO', 'Bago', 'THARRAWADDY', 'Tharrawaddy', 'Tharrawaddy', '["Tharyawaddy","Tharyarwaddy"]', '17.65', '95.78', 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', 'KMM03', 1, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('MM-BGO-NATTALIN', 'MM', 'BGO', 'Bago', 'NATTALIN', 'Nattalin', 'Nattalin', '[]', '18.45', '95.75', 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', 'KMM04', 1, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('MM-MON-MAWLAMYINE', 'MM', 'MON', 'Mon', 'MAWLAMYINE', 'Mawlamyine', 'Mawlamyine', '[]', '16.49', '97.63', 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', 'KMM02', 1, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('MM-MON-MUDON', 'MM', 'MON', 'Mon', 'MUDON', 'Mudon', 'Mudon', '[]', '16.26', '97.72', 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', NULL, 1, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('MM-MON-KYAIKMARAW', 'MM', 'MON', 'Mon', 'KYAIKMARAW', 'Kyaikmaraw', 'Kyaikmaraw', '["Kyaikemaraw"]', NULL, NULL, 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', NULL, 1, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('MM-MON-THANBYUZAYAT', 'MM', 'MON', 'Mon', 'THANBYUZAYAT', 'Thanbyuzayat', 'Thanbyuzayat', '[]', NULL, NULL, 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', NULL, 1, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('MM-KYN-HPAAN', 'MM', 'KYN', 'Kayin', 'HPAAN', 'Hpa-An', 'Hpa-An', '["Hpa-an"]', '16.89', '97.63', 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', 'KMM01', 1, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('MM-KYN-KAWKAREIK', 'MM', 'KYN', 'Kayin', 'KAWKAREIK', 'Kawkareik', 'Kawkareik', '[]', NULL, NULL, 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', NULL, 1, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('MM-KYN-MYAWADDY', 'MM', 'KYN', 'Kayin', 'MYAWADDY', 'Myawaddy', 'Myawaddy', '[]', '16.69', '98.51', 'pilot-2026-01', 'phase-1-pilot-scope', '2026-08-14', 'KMM06', 1, 'local-agriculture-phase1', 'local-agriculture-phase1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_locations` (`crop_location_id`, `location_id`, `crop_id`, `presence_status`, `importance_level`, `confidence_grade`, `notes`, `created_by`, `updated_by`)
SELECT 'crop-location-' || l.location_id || '-' || c.crop_code, l.location_id, c.crop_id, 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'No evidence supplied for Phase 1 pilot scope.', 'local-agriculture-phase1', 'local-agriculture-phase1'
FROM `agri_locations` l CROSS JOIN `agri_crops` c;
