-- KMM Agriculture Pass #4: Lower Myanmar seasonal evidence and official Union yield.
-- Local Operations D1 only. No state/township yield is derived or copied.

ALTER TABLE `agri_crop_calendars` ADD COLUMN `duration_days_min` integer;
--> statement-breakpoint
ALTER TABLE `agri_crop_calendars` ADD COLUMN `duration_days_max` integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_statistics_yield_scope_idx` ON `agri_crop_statistics` (`source_geography`, `geography_level`, `record_type`, `crop_id`, `crop_year`, `season_code`);
--> statement-breakpoint
UPDATE `agri_sources`
SET `publication_date` = '2024', `source_table` = '9.15'
WHERE `source_id` = 'source-cso-msyb-2024-agri-9-15';
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_sources` (`source_id`, `source_name`, `source_type`, `publisher`, `publication_date`, `source_geography`, `source_table`, `reference_uri`, `reliability_grade`, `notes`, `created_by`, `updated_by`) VALUES
  ('source-phase4-fao-lower-myanmar-cropping-pattern-2007', 'FAO Myanmar Lower Myanmar cropping pattern · Table 6', 'RESEARCH_BASELINE', 'FAO / Department of Agricultural Planning', '2007', 'REGIONAL', 'Table 6', 'https://www.fao.org/4/ai408e/ai408e06.htm', 'V4', 'Historical Lower Myanmar Ngamoeyeik Project cropping patterns. Pattern-specific evidence: black gram 70-day relay or tillage windows, green gram 70-day mid-October to December, and sesame 70–80-day second-week January to first-week April. Regional/historical context only; not Myanmar-wide truth and not State/Township actual.', 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_locations` (`location_id`, `country_code`, `state_region_code`, `state_region_name`, `district_code`, `district_name`, `township_code`, `township_name`, `canonical_name`, `alternate_names`, `myanmar_name`, `latitude`, `longitude`, `admin_version`, `source`, `source_date`, `kmm_branch_code`, `sales_territory_id`, `is_active`, `valid_from`, `valid_to`, `geography_level`, `created_by`, `updated_by`) VALUES
  ('MM-UNION', 'MM', NULL, NULL, NULL, NULL, NULL, NULL, 'Myanmar Union', '["Myanmar","Union","National"]', NULL, NULL, NULL, 'CSO-MSYB-2024', 'Central Statistical Organization, Myanmar Statistical Yearbook 2024', '2024', NULL, NULL, 1, NULL, NULL, 'NATIONAL', 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('MM-REG-LOWER-MYANMAR', 'MM', NULL, 'Lower Myanmar', NULL, NULL, NULL, NULL, 'Lower Myanmar', '["Lower Myanmar","Lower Myanmar regional baseline"]', NULL, NULL, NULL, 'FAO-LOWER-MYANMAR-2007', 'FAO / Department of Agricultural Planning · Table 6', '2007', NULL, NULL, 1, NULL, NULL, 'REGIONAL', 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_data_gaps` (`gap_id`, `location_id`, `crop_id`, `gap_type`, `priority`, `required_geography`, `latest_source_year`, `notes`, `status`, `created_by`, `updated_by`) VALUES
  ('gap-reg-lower-myanmar-black-gram-calendar', 'MM-REG-LOWER-MYANMAR', 'crop-black-gram', 'CALENDAR', 'MEDIUM', 'REGIONAL', 2007, 'Lower Myanmar regional/historical baseline is available. Township calendar remains OPEN and no local dates are inferred.', 'RESOLVED', 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('gap-reg-lower-myanmar-green-gram-calendar', 'MM-REG-LOWER-MYANMAR', 'crop-green-gram', 'CALENDAR', 'MEDIUM', 'REGIONAL', 2007, 'Lower Myanmar regional/historical baseline is available. Township calendar remains OPEN and no local dates are inferred.', 'RESOLVED', 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('gap-reg-lower-myanmar-sesame-calendar', 'MM-REG-LOWER-MYANMAR', 'crop-sesame', 'CALENDAR', 'MEDIUM', 'REGIONAL', 2007, 'Lower Myanmar regional/historical baseline is available. Township calendar remains OPEN and no local dates are inferred.', 'RESOLVED', 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('gap-national-yield-backbone', 'MM-UNION', NULL, 'YIELD', 'MEDIUM', 'NATIONAL', 2024, 'CSO Myanmar Statistical Yearbook 2024 Table 9.15 provides official Union yield for supported crops. State/Region and Township yield gaps remain OPEN.', 'RESOLVED', 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_calendars` (`calendar_record_id`, `location_id`, `crop_id`, `season_id`, `crop_year`, `stage_code`, `baseline_start_date`, `baseline_end_date`, `calendar_precision`, `window_start_month`, `window_end_month`, `duration_days_min`, `duration_days_max`, `valid_from_year`, `valid_to_year`, `notes`, `calendar_type`, `source_geography`, `source_id`, `source_publication_date`, `verification_level`, `confidence_score`, `inherited_from_location_id`, `weather_adjusted`, `calendar_shift_status`, `calendar_shift_days`, `local_verified`, `verified_by`, `verified_at`, `created_by`, `updated_by`) VALUES
  ('cal-phase4-lower-myanmar-black-gram-relay-sowing', 'MM-REG-LOWER-MYANMAR', 'crop-black-gram', 'season-post-monsoon', NULL, 'SOWING', NULL, NULL, 'MID_MONTH', 9, 9, 70, 70, 2007, 2007, 'Pattern 1 · relay after rainy-season rice. Source window: mid-September to November; this row records the sourced sowing point and preserves the pattern note.', 'REGIONAL_BASELINE', 'REGIONAL', 'source-phase4-fao-lower-myanmar-cropping-pattern-2007', '2007', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('cal-phase4-lower-myanmar-black-gram-relay-harvest', 'MM-REG-LOWER-MYANMAR', 'crop-black-gram', 'season-post-monsoon', NULL, 'HARVEST', NULL, NULL, 'MONTH', 11, 11, 70, 70, 2007, 2007, 'Pattern 1 · relay after rainy-season rice. Source window: mid-September to November; harvest month is published without an exact week.', 'REGIONAL_BASELINE', 'REGIONAL', 'source-phase4-fao-lower-myanmar-cropping-pattern-2007', '2007', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('cal-phase4-lower-myanmar-black-gram-tillage-sowing', 'MM-REG-LOWER-MYANMAR', 'crop-black-gram', 'season-post-monsoon', NULL, 'SOWING', NULL, NULL, 'LATE_MONTH', 9, 9, 70, 70, 2007, 2007, 'Pattern 2 · tillage after rainy-season rice. Source window: fourth week of September to first week of December; no Township actual is asserted.', 'REGIONAL_BASELINE', 'REGIONAL', 'source-phase4-fao-lower-myanmar-cropping-pattern-2007', '2007', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('cal-phase4-lower-myanmar-black-gram-tillage-harvest', 'MM-REG-LOWER-MYANMAR', 'crop-black-gram', 'season-post-monsoon', NULL, 'HARVEST', NULL, NULL, 'EARLY_MONTH', 12, 12, 70, 70, 2007, 2007, 'Pattern 2 · tillage after rainy-season rice. Source window: fourth week of September to first week of December; harvest is early December.', 'REGIONAL_BASELINE', 'REGIONAL', 'source-phase4-fao-lower-myanmar-cropping-pattern-2007', '2007', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('cal-phase4-lower-myanmar-green-gram-sowing', 'MM-REG-LOWER-MYANMAR', 'crop-green-gram', 'season-post-monsoon', NULL, 'SOWING', NULL, NULL, 'MID_MONTH', 10, 10, 70, 70, 2007, 2007, 'Rice → Green Gram → Sesame pattern. Source gives a 70-day Green Gram window from mid-October to December; no local current stage is inferred.', 'REGIONAL_BASELINE', 'REGIONAL', 'source-phase4-fao-lower-myanmar-cropping-pattern-2007', '2007', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('cal-phase4-lower-myanmar-green-gram-harvest', 'MM-REG-LOWER-MYANMAR', 'crop-green-gram', 'season-post-monsoon', NULL, 'HARVEST', NULL, NULL, 'MONTH', 12, 12, 70, 70, 2007, 2007, 'Rice → Green Gram → Sesame pattern. Source gives a 70-day Green Gram window from mid-October to December; exact harvest week is not published.', 'REGIONAL_BASELINE', 'REGIONAL', 'source-phase4-fao-lower-myanmar-cropping-pattern-2007', '2007', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('cal-phase4-lower-myanmar-sesame-sowing', 'MM-REG-LOWER-MYANMAR', 'crop-sesame', 'season-post-monsoon', NULL, 'SOWING', NULL, NULL, 'EARLY_MONTH', 1, 1, 70, 80, 2007, 2007, 'Rice → Green Gram → Sesame pattern. Source window: second week of January to first week of April; source-specific precision is retained in notes.', 'REGIONAL_BASELINE', 'REGIONAL', 'source-phase4-fao-lower-myanmar-cropping-pattern-2007', '2007', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'),
  ('cal-phase4-lower-myanmar-sesame-harvest', 'MM-REG-LOWER-MYANMAR', 'crop-sesame', 'season-post-monsoon', NULL, 'HARVEST', NULL, NULL, 'EARLY_MONTH', 4, 4, 70, 80, 2007, 2007, 'Rice → Green Gram → Sesame pattern. Source window: second week of January to first week of April; harvest is early April.', 'REGIONAL_BASELINE', 'REGIONAL', 'source-phase4-fao-lower-myanmar-cropping-pattern-2007', '2007', 'V4', 100, NULL, 0, 'UNKNOWN', NULL, 0, NULL, NULL, 'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4');
--> statement-breakpoint
WITH yield_seed(crop_code, crop_year, season_code, yield_value, yield_unit, source_crop_name, notes) AS (
  VALUES
    ('RICE', 2019, NULL, 75, '46lb(basket)', 'Paddy', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('RICE', 2020, NULL, 75, '46lb(basket)', 'Paddy', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('RICE', 2021, NULL, 76, '46lb(basket)', 'Paddy', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('RICE', 2022, NULL, 77, '46lb(basket)', 'Paddy', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('RICE', 2023, NULL, 82, '46lb(basket)', 'Paddy', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('MAIZE', 2019, NULL, 64, '55lb(basket)', 'Maize', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('MAIZE', 2020, NULL, 64, '55lb(basket)', 'Maize', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('MAIZE', 2021, NULL, 62, '55lb(basket)', 'Maize', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('MAIZE', 2022, NULL, 63, '55lb(basket)', 'Maize', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('MAIZE', 2023, NULL, 65, '55lb(basket)', 'Maize', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('GROUNDNUT', 2019, 'RAIN', 46, '25lb(basket)', 'Groundnut Rain', 'CSO Table 9.15 Union yield per harvested acre; RAIN subtype preserved.'),
    ('GROUNDNUT', 2019, 'WINTER', 62, '25lb(basket)', 'Groundnut Winter', 'CSO Table 9.15 Union yield per harvested acre; WINTER subtype preserved.'),
    ('GROUNDNUT', 2020, 'RAIN', 43, '25lb(basket)', 'Groundnut Rain', 'CSO Table 9.15 Union yield per harvested acre; RAIN subtype preserved.'),
    ('GROUNDNUT', 2020, 'WINTER', 62, '25lb(basket)', 'Groundnut Winter', 'CSO Table 9.15 Union yield per harvested acre; WINTER subtype preserved.'),
    ('GROUNDNUT', 2021, 'RAIN', 45, '25lb(basket)', 'Groundnut Rain', 'CSO Table 9.15 Union yield per harvested acre; RAIN subtype preserved.'),
    ('GROUNDNUT', 2021, 'WINTER', 62, '25lb(basket)', 'Groundnut Winter', 'CSO Table 9.15 Union yield per harvested acre; WINTER subtype preserved.'),
    ('GROUNDNUT', 2022, 'RAIN', 46, '25lb(basket)', 'Groundnut Rain', 'CSO Table 9.15 Union yield per harvested acre; RAIN subtype preserved.'),
    ('GROUNDNUT', 2022, 'WINTER', 62, '25lb(basket)', 'Groundnut Winter', 'CSO Table 9.15 Union yield per harvested acre; WINTER subtype preserved.'),
    ('GROUNDNUT', 2023, 'RAIN', 51, '25lb(basket)', 'Groundnut Rain', 'CSO Table 9.15 Union yield per harvested acre; RAIN subtype preserved.'),
    ('GROUNDNUT', 2023, 'WINTER', 64, '25lb(basket)', 'Groundnut Winter', 'CSO Table 9.15 Union yield per harvested acre; WINTER subtype preserved.'),
    ('SESAME', 2019, 'EARLY', 6, '54lb(basket)', 'Sesamum Early', 'CSO Table 9.15 Union yield per harvested acre; EARLY subtype preserved.'),
    ('SESAME', 2019, 'LATE', 13, '54lb(basket)', 'Sesamum Late', 'CSO Table 9.15 Union yield per harvested acre; LATE subtype preserved.'),
    ('SESAME', 2020, 'EARLY', 5, '54lb(basket)', 'Sesamum Early', 'CSO Table 9.15 Union yield per harvested acre; EARLY subtype preserved.'),
    ('SESAME', 2020, 'LATE', 13, '54lb(basket)', 'Sesamum Late', 'CSO Table 9.15 Union yield per harvested acre; LATE subtype preserved.'),
    ('SESAME', 2021, 'EARLY', 6, '54lb(basket)', 'Sesamum Early', 'CSO Table 9.15 Union yield per harvested acre; EARLY subtype preserved.'),
    ('SESAME', 2021, 'LATE', 13, '54lb(basket)', 'Sesamum Late', 'CSO Table 9.15 Union yield per harvested acre; LATE subtype preserved.'),
    ('SESAME', 2022, 'EARLY', 6, '54lb(basket)', 'Sesamum Early', 'CSO Table 9.15 Union yield per harvested acre; EARLY subtype preserved.'),
    ('SESAME', 2022, 'LATE', 13, '54lb(basket)', 'Sesamum Late', 'CSO Table 9.15 Union yield per harvested acre; LATE subtype preserved.'),
    ('SESAME', 2023, 'EARLY', 7, '54lb(basket)', 'Sesamum Early', 'CSO Table 9.15 Union yield per harvested acre; EARLY subtype preserved.'),
    ('SESAME', 2023, 'LATE', 13, '54lb(basket)', 'Sesamum Late', 'CSO Table 9.15 Union yield per harvested acre; LATE subtype preserved.'),
    ('RUBBER', 2019, NULL, 710, 'lb', 'Rubber', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('RUBBER', 2020, NULL, 709, 'lb', 'Rubber', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('RUBBER', 2021, NULL, 670, 'lb', 'Rubber', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('RUBBER', 2022, NULL, 716, 'lb', 'Rubber', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('RUBBER', 2023, NULL, 725, 'lb', 'Rubber', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('BLACK_GRAM', 2019, NULL, 18, '72lb(basket)', 'Matpe (Black gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('BLACK_GRAM', 2020, NULL, 18, '72lb(basket)', 'Matpe (Black gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('BLACK_GRAM', 2021, NULL, 18, '72lb(basket)', 'Matpe (Black gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('BLACK_GRAM', 2022, NULL, 18, '72lb(basket)', 'Matpe (Black gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('BLACK_GRAM', 2023, NULL, 22, '72lb(basket)', 'Matpe (Black gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('GREEN_GRAM', 2019, NULL, 16, '72lb(basket)', 'Pedisein (Green gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('GREEN_GRAM', 2020, NULL, 16, '72lb(basket)', 'Pedisein (Green gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('GREEN_GRAM', 2021, NULL, 16, '72lb(basket)', 'Pedisein (Green gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('GREEN_GRAM', 2022, NULL, 16, '72lb(basket)', 'Pedisein (Green gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.'),
    ('GREEN_GRAM', 2023, NULL, 18, '72lb(basket)', 'Pedisein (Green gram)', 'CSO Table 9.15 Union yield per harvested acre; native unit preserved.')
)
INSERT OR IGNORE INTO `agri_crop_statistics` (`statistic_id`, `location_id`, `crop_id`, `crop_year`, `season_code`, `cultivated_area`, `area_unit`, `sown_area`, `sown_area_unit`, `harvested_area`, `harvested_area_unit`, `production`, `production_unit`, `yield`, `yield_unit`, `source_id`, `source_table`, `source_crop_name`, `source_geography`, `geography_level`, `source_year`, `record_type`, `value_qualifier`, `verification_status`, `confidence_score`, `notes`, `created_by`, `updated_by`)
SELECT
  'stat-cso-msyb2024-agri915-union-' || lower(replace(y.crop_code, '_', '-')) || '-' || y.crop_year || coalesce('-' || lower(y.season_code), ''),
  'MM-UNION', c.crop_id, y.crop_year, y.season_code, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, y.yield_value, y.yield_unit,
  'source-cso-msyb-2024-agri-9-15', '9.15', y.source_crop_name, 'NATIONAL', 'NATIONAL', 2024, 'ACTUAL_OFFICIAL', 'EXACT', 'V4', 100, y.notes,
  'local-agriculture-calendar-yield-pass4', 'local-agriculture-calendar-yield-pass4'
FROM yield_seed y JOIN `agri_crops` c ON c.crop_code = y.crop_code;
