-- Agriculture Pass #3: source-backed seasonal calendar backbone.
-- Local Operations D1 only. Month windows are structured separately from
-- dated observations so a seasonal baseline never receives a fabricated year.

ALTER TABLE `agri_crop_calendars` ADD COLUMN `calendar_precision` text DEFAULT 'MONTH' NOT NULL;
--> statement-breakpoint
ALTER TABLE `agri_crop_calendars` ADD COLUMN `window_start_month` integer;
--> statement-breakpoint
ALTER TABLE `agri_crop_calendars` ADD COLUMN `window_end_month` integer;
--> statement-breakpoint
ALTER TABLE `agri_crop_calendars` ADD COLUMN `valid_from_year` integer;
--> statement-breakpoint
ALTER TABLE `agri_crop_calendars` ADD COLUMN `valid_to_year` integer;
--> statement-breakpoint
ALTER TABLE `agri_crop_calendars` ADD COLUMN `notes` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_calendars_scope_idx` ON `agri_crop_calendars` (`calendar_type`, `source_geography`, `crop_id`, `season_id`);
--> statement-breakpoint
UPDATE `agri_crop_calendars`
SET `calendar_precision` = CASE
      WHEN `calendar_record_id` = 'calendar-phase1a14-mudon-rice-2024-25-harvest' THEN 'MONTH_RANGE'
      ELSE 'MONTH'
    END,
    `window_start_month` = CASE
      WHEN `calendar_record_id` = 'calendar-phase1a14-mudon-rice-2024-25-harvest' THEN 11
      WHEN `calendar_record_id` = 'calendar-phase1a14-nattalin-rice-2025-sowing' THEN 6
      ELSE NULL
    END,
    `window_end_month` = CASE
      WHEN `calendar_record_id` = 'calendar-phase1a14-mudon-rice-2024-25-harvest' THEN 12
      ELSE NULL
    END,
    `valid_from_year` = CASE
      WHEN `calendar_record_id` = 'calendar-phase1a14-mudon-rice-2024-25-harvest' THEN 2024
      WHEN `calendar_record_id` = 'calendar-phase1a14-nattalin-rice-2025-sowing' THEN 2025
      ELSE NULL
    END,
    `valid_to_year` = CASE
      WHEN `calendar_record_id` = 'calendar-phase1a14-mudon-rice-2024-25-harvest' THEN 2025
      ELSE NULL
    END,
    `notes` = CASE
      WHEN `calendar_record_id` = 'calendar-phase1a14-mudon-rice-2024-25-harvest' THEN 'Historical township observation: 2024/25 monsoon rice harvest began in November 2024 and completed in December 2024. Not a current estimate.'
      WHEN `calendar_record_id` = 'calendar-phase1a14-nattalin-rice-2025-sowing' THEN 'Township planting-plan evidence from 2025. It does not establish a current crop stage or current harvest estimate.'
      ELSE `notes`
    END,
    `updated_by` = 'local-agriculture-phase3';
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_sources` (`source_id`, `source_name`, `source_type`, `publisher`, `publication_date`, `source_geography`, `reference_uri`, `reliability_grade`, `notes`, `created_by`, `updated_by`) VALUES
  ('source-phase3-fao-myanmar-crop-calendar-2000', 'FAO Myanmar lower-Myanmar paddy crop calendar', 'AUTHORITATIVE_BASELINE', 'FAO MIS / Department of Agricultural Planning', '2000-10', 'REGIONAL', 'https://faolex.fao.org/docs/pdf/mya190985.pdf', 'V4', 'Table 5 records Lower Myanmar wet-season paddy sowing in May–June and harvesting in October–December, and dry/summer paddy sowing in October–November with harvesting in February–April. Month windows only; no exact dates or state/township actuals are asserted. Source note: Agricultural marketing in Myanmar (TCP/MYA/8821), FAO MIS project, Oct. 2000 and DAP.', 'local-agriculture-phase3', 'local-agriculture-phase3');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_seasons` (`season_id`, `season_code`, `season_name`, `country_code`, `notes`, `created_by`, `updated_by`) VALUES
  ('season-secondary', 'SECONDARY', 'Secondary', 'MM', 'Season category reserved for a separately sourced second crop; no current stage is inferred.', 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('season-post-monsoon', 'POST_MONSOON', 'Post-monsoon', 'MM', 'Season category for source-backed post-monsoon windows; no unsourced crop calendar is created.', 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('season-irrigated', 'IRRIGATED', 'Irrigated', 'MM', 'Season category for explicitly irrigated crop windows; it does not upgrade township presence.', 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('season-perennial', 'PERENNIAL', 'Perennial', 'MM', 'Perennial activity season for rubber; activity windows are regional context only.', 'local-agriculture-phase3', 'local-agriculture-phase3');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_calendars` (`calendar_record_id`, `location_id`, `crop_id`, `season_id`, `crop_year`, `stage_code`, `baseline_start_date`, `baseline_end_date`, `calendar_precision`, `window_start_month`, `window_end_month`, `valid_from_year`, `valid_to_year`, `notes`, `calendar_type`, `source_geography`, `source_id`, `source_publication_date`, `verification_level`, `confidence_score`, `inherited_from_location_id`, `weather_adjusted`, `calendar_shift_status`, `calendar_shift_days`, `local_verified`, `verified_by`, `verified_at`, `created_by`, `updated_by`) VALUES
  ('calendar-phase3-bago-rice-main-sowing', 'MM-REG-BAGO', 'crop-rice', 'season-main-monsoon', NULL, 'SOWING', NULL, NULL, 'MONTH_RANGE', 5, 6, 2000, NULL, 'Lower Myanmar regional calendar displayed in Bago Region state/region view. It is a source-backed baseline, not a Bago state actual and not township current stage.', 'STATE_REGION_BASELINE', 'REGIONAL', 'source-phase3-fao-myanmar-crop-calendar-2000', '2000-10', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('calendar-phase3-bago-rice-main-harvest', 'MM-REG-BAGO', 'crop-rice', 'season-main-monsoon', NULL, 'HARVEST', NULL, NULL, 'MONTH_RANGE', 10, 12, 2000, NULL, 'Lower Myanmar regional calendar displayed in Bago Region state/region view. It is a source-backed baseline, not a Bago state actual and not township current stage.', 'STATE_REGION_BASELINE', 'REGIONAL', 'source-phase3-fao-myanmar-crop-calendar-2000', '2000-10', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('calendar-phase3-bago-rice-summer-sowing', 'MM-REG-BAGO', 'crop-rice', 'season-summer', NULL, 'SOWING', NULL, NULL, 'MONTH_RANGE', 10, 11, 2000, NULL, 'FAO dry/summer paddy window for Lower Myanmar. State/region baseline only; no township cultivation or current stage is inferred.', 'STATE_REGION_BASELINE', 'REGIONAL', 'source-phase3-fao-myanmar-crop-calendar-2000', '2000-10', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('calendar-phase3-bago-rice-summer-harvest', 'MM-REG-BAGO', 'crop-rice', 'season-summer', NULL, 'HARVEST', NULL, NULL, 'MONTH_RANGE', 2, 4, 2000, NULL, 'FAO dry/summer paddy window for Lower Myanmar. State/region baseline only; no township cultivation or current stage is inferred.', 'STATE_REGION_BASELINE', 'REGIONAL', 'source-phase3-fao-myanmar-crop-calendar-2000', '2000-10', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('calendar-phase3-bago-rubber-tapping', 'MM-REG-BAGO', 'crop-rubber', 'season-perennial', NULL, 'TAPPING', NULL, NULL, 'MONTH_RANGE', 10, 1, 2026, NULL, 'Regional rubber activity context: general peak tapping/production is October–January. No Bago township stage or acreage is inferred.', 'REGIONAL_BASELINE', 'NATIONAL_REGIONAL', 'source-phase1a14-rubber-national-regional', '2026-05-04', 'V1', 25, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('calendar-phase3-mon-rubber-tapping', 'MM-STATE-MON', 'crop-rubber', 'season-perennial', NULL, 'TAPPING', NULL, NULL, 'MONTH_RANGE', 10, 1, 2026, NULL, 'Regional rubber activity context: general peak tapping/production is October–January. No Mon township stage or acreage is inferred.', 'REGIONAL_BASELINE', 'NATIONAL_REGIONAL', 'source-phase1a14-rubber-national-regional', '2026-05-04', 'V1', 25, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-phase3', 'local-agriculture-phase3'),
  ('calendar-phase3-kayin-rubber-tapping', 'MM-STATE-KAYIN', 'crop-rubber', 'season-perennial', NULL, 'TAPPING', NULL, NULL, 'MONTH_RANGE', 10, 1, 2026, NULL, 'Regional rubber activity context: general peak tapping/production is October–January. No Kayin township stage or acreage is inferred.', 'REGIONAL_BASELINE', 'NATIONAL_REGIONAL', 'source-phase1a14-rubber-national-regional', '2026-05-04', 'V1', 25, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-phase3', 'local-agriculture-phase3');
