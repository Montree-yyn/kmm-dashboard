-- Agriculture data completion master pass: Local Operations D1 only.
-- Adds source-backed statistics, varieties, and historical hazards without
-- creating current estimates, crop impact scores, or opportunity records.

ALTER TABLE `agri_crops` ADD COLUMN `alternate_names` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `agri_crop_calendars` ADD COLUMN `calendar_type` text DEFAULT 'AUTHORITATIVE_BASELINE' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_crop_statistics` (
  `statistic_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `crop_id` text NOT NULL,
  `crop_year` integer,
  `season_code` text,
  `cultivated_area` real,
  `area_unit` text,
  `production` real,
  `production_unit` text,
  `yield` real,
  `yield_unit` text,
  `source_id` text NOT NULL,
  `source_geography` text NOT NULL,
  `source_year` integer,
  `record_type` text DEFAULT 'ACTUAL' NOT NULL,
  `value_qualifier` text DEFAULT 'EXACT' NOT NULL,
  `verification_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `confidence_score` integer,
  `notes` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_statistics_location_crop_year_idx` ON `agri_crop_statistics` (`location_id`, `crop_id`, `crop_year`, `season_code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_statistics_scope_idx` ON `agri_crop_statistics` (`source_geography`, `record_type`, `value_qualifier`, `verification_status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_crop_varieties` (
  `variety_id` text PRIMARY KEY NOT NULL,
  `crop_id` text NOT NULL,
  `canonical_name` text NOT NULL,
  `alternate_names` text DEFAULT '[]' NOT NULL,
  `local_name` text,
  `country_code` text,
  `notes` text,
  `source_id` text NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agri_crop_varieties_crop_name_unique` ON `agri_crop_varieties` (`crop_id`, `canonical_name`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_varieties_active_idx` ON `agri_crop_varieties` (`crop_id`, `is_active`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_location_crop_varieties` (
  `location_crop_variety_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `crop_id` text NOT NULL,
  `variety_id` text NOT NULL,
  `season_code` text,
  `evidence_year` integer,
  `source_id` text NOT NULL,
  `verification_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `confidence_score` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agri_location_crop_varieties_scope_unique` ON `agri_location_crop_varieties` (`location_id`, `crop_id`, `variety_id`, `season_code`, `evidence_year`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_location_crop_varieties_location_idx` ON `agri_location_crop_varieties` (`location_id`, `crop_id`, `verification_status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_historical_hazards` (
  `hazard_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `hazard_type` text NOT NULL,
  `event_start` text,
  `event_end` text,
  `event_year` integer,
  `severity` text,
  `affected_area` real,
  `affected_area_unit` text,
  `description` text,
  `source_id` text NOT NULL,
  `verification_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `confidence_score` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_historical_hazards_location_year_idx` ON `agri_historical_hazards` (`location_id`, `event_year`, `hazard_type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_historical_hazards_verification_idx` ON `agri_historical_hazards` (`verification_status`, `confidence_score`);
--> statement-breakpoint
UPDATE `agri_crops`
SET `alternate_names` = '["Mung bean"]', `updated_by` = 'local-agriculture-master-pass'
WHERE `crop_code` = 'GREEN_GRAM';
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crops` (`crop_id`, `crop_code`, `crop_name`, `crop_cycle_type`, `alternate_names`, `created_by`, `updated_by`) VALUES
  ('crop-sunflower', 'SUNFLOWER', 'Sunflower', 'ANNUAL', '[]', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('crop-chickpea', 'CHICKPEA', 'Chickpea', 'ANNUAL', '[]', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('crop-cotton', 'COTTON', 'Cotton', 'ANNUAL', '[]', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('crop-jute-kenaf', 'JUTE_KENAF', 'Jute / Kenaf', 'ANNUAL', '[]', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('crop-vegetables', 'VEGETABLES', 'Vegetables', 'MULTI_SEASON_ANNUAL', '[]', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('crop-fruits', 'FRUITS', 'Fruits', 'PERENNIAL', '[]', 'local-agriculture-master-pass', 'local-agriculture-master-pass');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_sources` (`source_id`, `source_name`, `source_type`, `publisher`, `publication_date`, `source_geography`, `reference_uri`, `reliability_grade`, `notes`, `created_by`, `updated_by`) VALUES
  ('source-masterpass-nattalin-oilseed', 'Nattalin winter 2024/25 oilseed cultivation', 'RESEARCH_BASELINE', 'Myanmar Digital News / Township Department of Agriculture', '2025-01-11', 'TOWNSHIP', 'https://www.mdn.gov.mm/en/nattalin-township-completes-cultivation-7532-acres-oilseed-crops', 'V1', 'Source reports completed winter 2024/25 oilseed cultivation of 2,730 acres groundnut, 1,988 acres sesame, and 2,814 acres sunflower. Used for the sunflower statistic and source-level provenance.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('source-masterpass-mudon-summer-paddy-target', 'Mudon 2024/25 summer paddy target', 'RESEARCH_BASELINE', 'Myawady Daily / Township Agriculture Department', '2024-12-26', 'TOWNSHIP', 'https://www.myawady.net.mm/sites/default/files/MWD%2026-12-2024.pdf', 'V1', 'Source reports an earmarked target of 1,000 acres of summer paddy in Mudon Township for 2024/25. Target only; never counted as actual cultivated area.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('source-masterpass-mudon-sunflower-target', 'Mudon 2024/25 sunflower target', 'RESEARCH_BASELINE', 'Myanmar Digital News / Township Department of Agriculture', '2024-10-09', 'TOWNSHIP', 'https://www.mdn.gov.mm/en/mudon-township-targets-1500-acres-sunflower-crop-cultivation', 'V1', 'Source reports a target of 1,500 acres of edible oil crops, mostly sunflower, in Mudon Township for 2024/25. Target only; never counted as actual cultivated area.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('source-masterpass-hpaan-flood-2023', 'Hpa-An 2023 flood event', 'HISTORICAL_HAZARD', 'Myanmar Digital News / District IPRD', '2023-08-07', 'TOWNSHIP', 'https://www.mdn.gov.mm/en/relief-items-health-care-provided-flood-victims-hpa', 'V1', 'Source reports Thanlwin River above danger mark, inundation of low-lying Hpa-An areas, and evacuation of flood victims. Historical hazard context only; no crop impact inferred.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('source-masterpass-kawkareik-flood-2019', 'Kawkareik 2019 flood event', 'HISTORICAL_HAZARD', 'Myanmar Digital News / IPRD', '2019-08-07', 'TOWNSHIP', 'https://www.mdn.gov.mm/en/deluge-water-causes-schools-temporarily-suspend-kawkareik', 'V1', 'Source reports torrential downpours, inundation, rescue camps, evacuations, and temporary school closures in Kawkareik. Historical hazard context only; no crop impact inferred.', 'local-agriculture-master-pass', 'local-agriculture-master-pass');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_seasons` (`season_id`, `season_code`, `season_name`, `country_code`, `notes`, `created_by`, `updated_by`) VALUES
  ('season-rain-fed', 'RAIN_FED', 'Rain-fed', 'MM', 'Season label from the Nattalin 2025 rain-fed rice source.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('season-winter', 'WINTER', 'Winter', 'MM', 'Season label for the Nattalin 2024/25 oilseed source.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('season-summer', 'SUMMER', 'Summer', 'MM', 'Season label for the Mudon 2024/25 summer paddy target source.', 'local-agriculture-master-pass', 'local-agriculture-master-pass');
--> statement-breakpoint
UPDATE `agri_crop_calendars`
SET `calendar_type` = CASE
  WHEN `calendar_record_id` = 'calendar-phase1a14-mudon-rice-2024-25-harvest' THEN 'HISTORICAL_OBSERVED'
  ELSE 'AUTHORITATIVE_BASELINE'
END,
`season_id` = CASE
  WHEN `calendar_record_id` = 'calendar-phase1a14-nattalin-rice-2025-sowing' THEN 'season-rain-fed'
  ELSE `season_id`
END,
`updated_by` = 'local-agriculture-master-pass';
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_locations` (`crop_location_id`, `location_id`, `crop_id`, `presence_status`, `importance_level`, `evidence_geography`, `evidence_year`, `source_id`, `confidence_grade`, `cultivated_area`, `cultivated_area_unit`, `cultivated_area_year`, `local_verified`, `notes`, `created_by`, `updated_by`)
VALUES ('crop-location-MM-BGO-NATTALIN-SUNFLOWER', 'MM-BGO-NATTALIN', 'crop-sunflower', 'CONFIRMED_PRESENT', 'UNKNOWN', 'TOWNSHIP', 2024, 'source-masterpass-nattalin-oilseed', 'V1', '2814', 'acres', 2024, 0, 'Winter 2024/25 completed cultivation of 2,814 acres. Current stage remains UNKNOWN.', 'local-agriculture-master-pass', 'local-agriculture-master-pass');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_statistics` (`statistic_id`, `location_id`, `crop_id`, `crop_year`, `season_code`, `cultivated_area`, `area_unit`, `production`, `production_unit`, `yield`, `yield_unit`, `source_id`, `source_geography`, `source_year`, `record_type`, `value_qualifier`, `verification_status`, `confidence_score`, `notes`, `created_by`, `updated_by`) VALUES
  ('stat-masterpass-nattalin-rice-2025-plan', 'MM-BGO-NATTALIN', 'crop-rice', 2025, 'RAIN_FED', 110262, 'acres', NULL, NULL, NULL, NULL, 'source-phase1a14-nattalin-rice', 'TOWNSHIP', 2025, 'PLAN', 'EXACT', 'V1', 25, 'Source describes a 2025 rain-fed cultivation plan, not completed actual harvest area. Kept as PLAN and excluded from actual cultivated-area KPI.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('stat-masterpass-nattalin-groundnut-2024', 'MM-BGO-NATTALIN', 'crop-groundnut', 2024, 'WINTER', 2730, 'acres', NULL, NULL, NULL, NULL, 'source-phase1a14-nattalin-groundnut', 'TOWNSHIP', 2024, 'ACTUAL', 'EXACT', 'V1', 25, 'Winter 2024/25 completed cultivation. No production or yield supplied.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('stat-masterpass-nattalin-sesame-2024', 'MM-BGO-NATTALIN', 'crop-sesame', 2024, 'WINTER', 1988, 'acres', NULL, NULL, NULL, NULL, 'source-phase1a14-nattalin-sesame', 'TOWNSHIP', 2024, 'ACTUAL', 'EXACT', 'V1', 25, 'Winter 2024/25 completed cultivation. No production or yield supplied.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('stat-masterpass-nattalin-sunflower-2024', 'MM-BGO-NATTALIN', 'crop-sunflower', 2024, 'WINTER', 2814, 'acres', NULL, NULL, NULL, NULL, 'source-masterpass-nattalin-oilseed', 'TOWNSHIP', 2024, 'ACTUAL', 'EXACT', 'V1', 25, 'Winter 2024/25 completed cultivation. No production or yield supplied.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('stat-masterpass-mudon-rice-2024-actual', 'MM-MON-MUDON', 'crop-rice', 2024, 'MAIN_MONSOON', 75000, 'acres', NULL, NULL, NULL, NULL, 'source-phase1a14-mudon-rice', 'TOWNSHIP', 2024, 'ACTUAL', 'MORE_THAN', 'V1', 25, 'Source says more than 75,000 acres were reaped. Numeric value is a lower bound; qualifier preserves the non-exact statement.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('stat-masterpass-mudon-summer-rice-2024-target', 'MM-MON-MUDON', 'crop-rice', 2024, 'SUMMER', 1000, 'acres', NULL, NULL, NULL, NULL, 'source-masterpass-mudon-summer-paddy-target', 'TOWNSHIP', 2024, 'TARGET', 'EXACT', 'V1', 25, 'Earmarked summer paddy target; excluded from actual cultivated-area KPI.', 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('stat-masterpass-mudon-sunflower-2024-target', 'MM-MON-MUDON', 'crop-sunflower', 2024, 'WINTER', 1500, 'acres', NULL, NULL, NULL, NULL, 'source-masterpass-mudon-sunflower-target', 'TOWNSHIP', 2024, 'TARGET', 'EXACT', 'V1', 25, 'Sunflower/edible-oil cultivation target; excluded from actual cultivated-area KPI.', 'local-agriculture-master-pass', 'local-agriculture-master-pass');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_varieties` (`variety_id`, `crop_id`, `canonical_name`, `alternate_names`, `local_name`, `country_code`, `notes`, `source_id`, `is_active`, `created_by`, `updated_by`) VALUES
  ('variety-rice-sinthukha', 'crop-rice', 'Sinthukha', '[]', NULL, 'MM', 'Nattalin source-listed rice variety; no acreage split inferred.', 'source-phase1a14-nattalin-rice', 1, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('variety-rice-yadanartoe', 'crop-rice', 'Yadanartoe', '[]', NULL, 'MM', 'Nattalin source-listed rice variety; no acreage split inferred.', 'source-phase1a14-nattalin-rice', 1, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('variety-rice-vietnam', 'crop-rice', 'Vietnam', '[]', NULL, 'MM', 'Nattalin source-listed rice variety; no acreage split inferred.', 'source-phase1a14-nattalin-rice', 1, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('variety-rice-hmawbi-3', 'crop-rice', 'Hmawbi-3', '[]', NULL, 'MM', 'Nattalin source-listed rice variety; no acreage split inferred.', 'source-phase1a14-nattalin-rice', 1, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('variety-rice-thaihnankauk', 'crop-rice', 'Thaihnankauk', '[]', NULL, 'MM', 'Spelling follows the Nattalin source: Thaihnankauk. No acreage split inferred.', 'source-phase1a14-nattalin-rice', 1, 'local-agriculture-master-pass', 'local-agriculture-master-pass');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_location_crop_varieties` (`location_crop_variety_id`, `location_id`, `crop_id`, `variety_id`, `season_code`, `evidence_year`, `source_id`, `verification_status`, `confidence_score`, `created_by`, `updated_by`) VALUES
  ('location-crop-variety-MM-BGO-NATTALIN-RICE-SINTHUKHA', 'MM-BGO-NATTALIN', 'crop-rice', 'variety-rice-sinthukha', 'RAIN_FED', 2025, 'source-phase1a14-nattalin-rice', 'RESEARCH_BASELINE', 25, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('location-crop-variety-MM-BGO-NATTALIN-RICE-YADANARTOE', 'MM-BGO-NATTALIN', 'crop-rice', 'variety-rice-yadanartoe', 'RAIN_FED', 2025, 'source-phase1a14-nattalin-rice', 'RESEARCH_BASELINE', 25, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('location-crop-variety-MM-BGO-NATTALIN-RICE-VIETNAM', 'MM-BGO-NATTALIN', 'crop-rice', 'variety-rice-vietnam', 'RAIN_FED', 2025, 'source-phase1a14-nattalin-rice', 'RESEARCH_BASELINE', 25, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('location-crop-variety-MM-BGO-NATTALIN-RICE-HMAWBI-3', 'MM-BGO-NATTALIN', 'crop-rice', 'variety-rice-hmawbi-3', 'RAIN_FED', 2025, 'source-phase1a14-nattalin-rice', 'RESEARCH_BASELINE', 25, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('location-crop-variety-MM-BGO-NATTALIN-RICE-THAIHNANKAUK', 'MM-BGO-NATTALIN', 'crop-rice', 'variety-rice-thaihnankauk', 'RAIN_FED', 2025, 'source-phase1a14-nattalin-rice', 'RESEARCH_BASELINE', 25, 'local-agriculture-master-pass', 'local-agriculture-master-pass');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_historical_hazards` (`hazard_id`, `location_id`, `hazard_type`, `event_start`, `event_end`, `event_year`, `severity`, `affected_area`, `affected_area_unit`, `description`, `source_id`, `verification_status`, `confidence_score`, `created_by`, `updated_by`) VALUES
  ('hazard-masterpass-hpaan-flood-2023', 'MM-KYN-HPAAN', 'FLOOD', '2023-08-07', NULL, 2023, NULL, NULL, NULL, 'Thanlwin River exceeded its danger mark and water entered low-lying Hpa-An areas; flood victims were evacuated. Historical hazard context only.', 'source-masterpass-hpaan-flood-2023', 'V1', 25, 'local-agriculture-master-pass', 'local-agriculture-master-pass'),
  ('hazard-masterpass-kawkareik-flood-2019', 'MM-KYN-KAWKAREIK', 'FLOOD', '2019-08-03', NULL, 2019, NULL, NULL, NULL, 'Torrential downpours caused inundation in Kawkareik; rescue camps, evacuations, and temporary school closures were reported. Historical hazard context only.', 'source-masterpass-kawkareik-flood-2019', 'V1', 25, 'local-agriculture-master-pass', 'local-agriculture-master-pass');
