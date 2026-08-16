-- Agriculture data gap closure pass #1: evidence-safe context and gap metadata.
-- Local Operations D1 only. Context and gaps never create crop presence,
-- cultivated area, production, yield, stage, risk, or opportunity records.

CREATE TABLE IF NOT EXISTS `agri_location_contexts` (
  `context_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `context_type` text NOT NULL,
  `context_geography` text NOT NULL,
  `context_subject` text NOT NULL,
  `evidence_year` integer,
  `source_id` text NOT NULL,
  `verification_status` text DEFAULT 'UNKNOWN' NOT NULL,
  `confidence_score` integer,
  `notes` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agri_location_contexts_scope_unique` ON `agri_location_contexts` (`location_id`, `context_type`, `context_subject`, `source_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_location_contexts_location_idx` ON `agri_location_contexts` (`location_id`, `context_geography`, `context_type`, `verification_status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_data_gaps` (
  `gap_id` text PRIMARY KEY NOT NULL,
  `location_id` text NOT NULL,
  `crop_id` text,
  `gap_type` text NOT NULL,
  `priority` text NOT NULL,
  `required_geography` text NOT NULL,
  `latest_source_year` integer,
  `notes` text,
  `status` text DEFAULT 'OPEN' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agri_data_gaps_scope_unique` ON `agri_data_gaps` (`location_id`, `crop_id`, `gap_type`, `required_geography`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_data_gaps_status_priority_idx` ON `agri_data_gaps` (`status`, `priority`, `location_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_sources` (`source_id`, `source_name`, `source_type`, `publisher`, `publication_date`, `source_geography`, `reference_uri`, `reliability_grade`, `notes`, `created_by`, `updated_by`) VALUES
  ('source-gap-mimu-thayarwady-2019', 'MIMU GAD Thayarwady Township Profile 2019', 'HISTORICAL_ADMIN_REFERENCE', 'Myanmar Information Management Unit / General Administration Department', '2020-08-24', 'TOWNSHIP', 'https://themimu.info/sites/themimu.info/files/documents/TspProfiles_GAD_Thayarwady_2019_MMR.pdf', 'V1', 'Historical administrative profile. Thayarwady is retained as the source spelling/alias for the canonical Tharrawaddy location; it does not establish current crop presence, acreage, or stage.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('source-gap-mimu-hpaan-2019', 'MIMU GAD Hpa-An Township Profile 2019', 'HISTORICAL_ADMIN_REFERENCE', 'Myanmar Information Management Unit / General Administration Department', '2020-08-24', 'TOWNSHIP', 'https://themimu.info/sites/themimu.info/files/documents/TspProfiles_GAD_Hpa-An_2019_MMR.pdf', 'V1', 'Historical administrative profile only. No current crop presence, acreage, production, yield, or stage is inferred.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('source-gap-mimu-kawkareik-2019', 'MIMU GAD Kawkareik Township Profile 2019', 'HISTORICAL_ADMIN_REFERENCE', 'Myanmar Information Management Unit / General Administration Department', '2020-08-24', 'TOWNSHIP', 'https://themimu.info/sites/themimu.info/files/documents/TspProfiles_GAD_Kawkareik_2019_MMR.pdf', 'V1', 'Historical administrative profile only. No current crop presence, acreage, production, yield, or stage is inferred.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('source-gap-mimu-myawaddy-2019', 'MIMU GAD Myawaddy Township Profile 2019', 'HISTORICAL_ADMIN_REFERENCE', 'Myanmar Information Management Unit / General Administration Department', '2020-08-24', 'TOWNSHIP', 'https://themimu.info/sites/themimu.info/files/documents/TspProfiles_GAD_Myawaddy_2019_MMR.pdf', 'V1', 'Historical administrative profile only. No current crop presence, acreage, production, yield, or stage is inferred.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('source-gap-mimu-hpaan-environment-2017', 'Hpa-An Township Environment Assessment Report November 2017', 'HISTORICAL_REFERENCE', 'Myanmar Information Management Unit', '2018-04-05', 'TOWNSHIP', 'https://themimu.info/sites/themimu.info/files/documents/Hpa_An_Township_Environment_Assessment_Report_Nov2017.pdf', 'V1', 'Historical environmental assessment reference. Any agriculture, farmland, flood, or heavy-rain evidence remains source-level historical context; no current crop fact or crop loss is inferred.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('source-gap-gyobingauk-monsoon-2025', 'Gyobingauk 2025 monsoon crop context', 'NEARBY_TOWNSHIP_REFERENCE', 'Myanmar Digital News / Township Department of Agriculture', '2025-09-25', 'TOWNSHIP', 'https://www.mdn.gov.mm/en/over-92000-acres-monsoon-crops-planted-gyobingauk-tsp', 'V1', 'Source reports 92,478 acres of monsoon crops in Gyobingauk Township, Thayawady District. Nearby township/district context only; never a Tharrawaddy Township crop fact or KPI input.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('source-gap-kawkareik-bridge-2023', 'Kawkareik Kawsue-Kyainsu rural bridge farmland benefit', 'FARMLAND_CONTEXT', 'Myanmar Digital News / Department of Rural Development', '2023-03-28', 'TOWNSHIP', 'https://www.mdn.gov.mm/en/rural-bridge-kawsue-kyainsu-village-kawkareik-township-inspected', 'V1', 'Source reports a rural bridge benefiting over 900 acres of farmland. Farmland access context only; not cultivated crop area, production, yield, or crop presence.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('source-gap-myawaddy-ewec-2017', 'Myawaddy EWEC agriculture training and maize trade context', 'AGRICULTURE_CONTEXT', 'Mekong Institute / EWEC Project', '2017-06-18', 'TOWNSHIP', 'https://mekonginstitute.org/wp-content/uploads/2023/05/6.-E-briefing-June-2017.pdf', 'V1', 'Source describes farmer input and technical assistance, demonstration/infrastructure plans, maize-production training, and maize trade discussions involving Myawaddy. Stored as agriculture/farmland/value-chain context only; it does not change the crop master or confirm a current maize record.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('source-gap-weather-open-meteo-geocoding-2026', 'Open-Meteo geocoding township coordinate audit', 'WEATHER_COORDINATES', 'Open-Meteo Geocoding / GeoNames', '2026-08-14', 'TOWNSHIP', 'https://open-meteo.com/en/docs/geocoding-api', 'V1', 'The geocoder returned Myanmar settlement points with matching township administrative labels for Kawkareik (16.55543, 98.2371), Kyaikmaraw (16.37794, 97.73449), and Thanbyuzayat (15.96893, 97.72745). Coordinates are used for shared weather mapping only, not crop facts.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_location_contexts` (`context_id`, `location_id`, `context_type`, `context_geography`, `context_subject`, `evidence_year`, `source_id`, `verification_status`, `confidence_score`, `notes`, `created_by`, `updated_by`) VALUES
  ('context-gap-tharrawaddy-mimu-2019', 'MM-BGO-THARRAWADDY', 'HISTORICAL_ADMIN_REFERENCE', 'TOWNSHIP', 'Thayarwady Township profile spelling/alias', 2019, 'source-gap-mimu-thayarwady-2019', 'V1', 25, 'Administrative historical reference only. Thayarwady/Tharrawaddy alias mapping does not create current crop presence, acreage, production, yield, or stage.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-tharrawaddy-gyobingauk-2025', 'MM-BGO-THARRAWADDY', 'NEARBY_TOWNSHIP_REFERENCE', 'DISTRICT', 'Gyobingauk Township / Thayawady District', 2025, 'source-gap-gyobingauk-monsoon-2025', 'V1', 25, 'Gyobingauk is not Tharrawaddy Township. The reported 92,478 acres and crop list remain nearby township/district context and are excluded from Tharrawaddy crop presence and KPI calculations.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-hpaan-mimu-2019', 'MM-KYN-HPAAN', 'HISTORICAL_REFERENCE', 'TOWNSHIP', 'Hpa-An Township profile', 2019, 'source-gap-mimu-hpaan-2019', 'V1', 25, 'Historical administrative reference only. No current Rice, Rubber, Maize, acreage, production, yield, calendar stage, or 2026 presence is inferred.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-hpaan-environment-2017', 'MM-KYN-HPAAN', 'HISTORICAL_REFERENCE', 'TOWNSHIP', 'Hpa-An environmental assessment', 2017, 'source-gap-mimu-hpaan-environment-2017', 'V1', 25, 'Historical environmental/agriculture/farmland context only. It does not create current crop presence, acreage, stage, or township crop loss.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-kawkareik-mimu-2019', 'MM-KYN-KAWKAREIK', 'HISTORICAL_ADMIN_REFERENCE', 'TOWNSHIP', 'Kawkareik Township profile', 2019, 'source-gap-mimu-kawkareik-2019', 'V1', 25, 'Historical administrative reference only. Current crop presence remains UNKNOWN.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-kawkareik-bridge-2023', 'MM-KYN-KAWKAREIK', 'FARMLAND_CONTEXT', 'TOWNSHIP', 'Kawsue-Kyainsu rural bridge project', 2023, 'source-gap-kawkareik-bridge-2023', 'V1', 25, 'The reported benefit of over 900 acres is farmland access context, not cultivated crop acreage and not evidence of a specific crop.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-myawaddy-mimu-2019', 'MM-KYN-MYAWADDY', 'HISTORICAL_ADMIN_REFERENCE', 'TOWNSHIP', 'Myawaddy Township profile', 2019, 'source-gap-mimu-myawaddy-2019', 'V1', 25, 'Historical administrative reference only. Current crop presence remains UNKNOWN.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-myawaddy-agriculture-2017', 'MM-KYN-MYAWADDY', 'AGRICULTURE_CONTEXT', 'TOWNSHIP', 'EWEC farmer assistance and training', 2017, 'source-gap-myawaddy-ewec-2017', 'V1', 25, 'Agriculture input/technical assistance, demonstration-farm, and farmer-training context. Not a current crop presence, acreage, stage, or yield record.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-myawaddy-farmland-2017', 'MM-KYN-MYAWADDY', 'FARMLAND_CONTEXT', 'TOWNSHIP', 'EWEC agriculture infrastructure and demonstration farms', 2017, 'source-gap-myawaddy-ewec-2017', 'V1', 25, 'Agriculture infrastructure and demonstration-farm context only. No cultivated-area value is copied into Myawaddy.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1'),
  ('context-gap-myawaddy-trade-2017', 'MM-KYN-MYAWADDY', 'TRADE_CONTEXT', 'TOWNSHIP', 'Myawaddy maize value-chain discussion', 2017, 'source-gap-myawaddy-ewec-2017', 'V1', 25, 'Maize trade/value-chain context only. It does not change Myawaddy crop presence from UNKNOWN to CONFIRMED_PRESENT.', 'local-agriculture-gap-pass-1', 'local-agriculture-gap-pass-1');
--> statement-breakpoint
WITH pilot(location_id) AS (
  VALUES
    ('MM-BGO-THARRAWADDY'),
    ('MM-KYN-HPAAN'),
    ('MM-KYN-KAWKAREIK'),
    ('MM-KYN-MYAWADDY'),
    ('MM-MON-MAWLAMYINE'),
    ('MM-MON-KYAIKMARAW'),
    ('MM-MON-THANBYUZAYAT'),
    ('MM-MON-MUDON'),
    ('MM-BGO-NATTALIN')
), gap_types(gap_type, priority) AS (
  VALUES
    ('CROP_PRESENCE', 'HIGH'),
    ('CULTIVATED_AREA', 'HIGH'),
    ('PRODUCTION', 'HIGH'),
    ('YIELD', 'HIGH'),
    ('CALENDAR', 'MEDIUM'),
    ('CURRENT_STAGE', 'HIGH'),
    ('VARIETY', 'LOW'),
    ('COORDINATES', 'HIGH'),
    ('WEATHER_MAPPING', 'HIGH')
)
INSERT OR IGNORE INTO `agri_data_gaps` (`gap_id`, `location_id`, `crop_id`, `gap_type`, `priority`, `required_geography`, `latest_source_year`, `notes`, `status`, `created_by`, `updated_by`)
SELECT
  'gap-' || lower(replace(replace(pilot.location_id, 'MM-', ''), '-', '_')) || '-' || lower(gap_types.gap_type),
  pilot.location_id,
  NULL,
  gap_types.gap_type,
  gap_types.priority,
  'TOWNSHIP',
  CASE
    WHEN gap_types.gap_type IN ('COORDINATES', 'WEATHER_MAPPING') THEN 2026
    WHEN pilot.location_id = 'MM-BGO-NATTALIN' THEN 2025
    WHEN pilot.location_id IN ('MM-MON-MUDON', 'MM-MON-KYAIKMARAW') THEN 2024
    WHEN pilot.location_id IN ('MM-MON-THANBYUZAYAT', 'MM-MON-MAWLAMYINE') THEN 2026
    WHEN pilot.location_id IN ('MM-BGO-THARRAWADDY', 'MM-KYN-HPAAN', 'MM-KYN-KAWKAREIK', 'MM-KYN-MYAWADDY') THEN 2019
    ELSE NULL
  END,
  CASE gap_types.gap_type
    WHEN 'CROP_PRESENCE' THEN 'Township-level crop presence is partial only where separately verified; historical, regional, nearby-township, trade, and farmland context are excluded.'
    WHEN 'CULTIVATED_AREA' THEN 'Township cultivated area requires a source-specific area record; farmland context and targets/plans are excluded from actual area.'
    WHEN 'PRODUCTION' THEN 'No township production value is verified; production is not derived from cultivated area.'
    WHEN 'YIELD' THEN 'No township yield value is verified; yield is not derived from area or production.'
    WHEN 'CALENDAR' THEN 'Only source-bound historical/baseline calendar records are shown; current estimates remain No Data until separately sourced.'
    WHEN 'CURRENT_STAGE' THEN 'Current crop stage is not inferred from weather, historical calendars, or administrative profiles.'
    WHEN 'VARIETY' THEN 'Variety records require source-backed township evidence and do not split acreage by inference.'
    WHEN 'COORDINATES' THEN 'Canonical township coordinate required for weather mapping; unresolved points remain No Data.'
    WHEN 'WEATHER_MAPPING' THEN 'Shared Open-Meteo mapping is complete only when a verified canonical coordinate and agriculture location link exist.'
    ELSE 'Needs verification.'
  END,
  CASE
    WHEN gap_types.gap_type = 'CROP_PRESENCE' AND pilot.location_id IN ('MM-BGO-NATTALIN', 'MM-MON-MUDON', 'MM-MON-KYAIKMARAW', 'MM-MON-THANBYUZAYAT') THEN 'PARTIAL'
    WHEN gap_types.gap_type = 'CULTIVATED_AREA' AND pilot.location_id IN ('MM-BGO-NATTALIN', 'MM-MON-MUDON') THEN 'PARTIAL'
    WHEN gap_types.gap_type = 'CALENDAR' AND pilot.location_id IN ('MM-BGO-NATTALIN', 'MM-MON-MUDON') THEN 'PARTIAL'
    WHEN gap_types.gap_type = 'VARIETY' AND pilot.location_id = 'MM-BGO-NATTALIN' THEN 'PARTIAL'
    WHEN gap_types.gap_type IN ('COORDINATES', 'WEATHER_MAPPING') AND pilot.location_id IN ('MM-KYN-KAWKAREIK', 'MM-MON-KYAIKMARAW', 'MM-MON-THANBYUZAYAT') THEN 'OPEN'
    WHEN gap_types.gap_type IN ('COORDINATES', 'WEATHER_MAPPING') THEN 'RESOLVED'
    ELSE 'OPEN'
  END,
  'local-agriculture-gap-pass-1',
  'local-agriculture-gap-pass-1'
FROM pilot CROSS JOIN gap_types;
--> statement-breakpoint
UPDATE `agri_locations`
SET `latitude` = '16.55543',
    `longitude` = '98.2371',
    `source` = 'data/master-townships.json; Open-Meteo geocoding',
    `source_date` = '2026-08-14',
    `admin_version` = 'master-townships-v1+open-meteo-geo-v1',
    `updated_by` = 'local-agriculture-gap-pass-1'
WHERE `location_id` = 'MM-KYN-KAWKAREIK' AND (`latitude` IS NULL OR `longitude` IS NULL);
--> statement-breakpoint
UPDATE `agri_locations`
SET `latitude` = '16.37794',
    `longitude` = '97.73449',
    `source` = 'data/master-townships.json; Open-Meteo geocoding',
    `source_date` = '2026-08-14',
    `admin_version` = 'master-townships-v1+open-meteo-geo-v1',
    `updated_by` = 'local-agriculture-gap-pass-1'
WHERE `location_id` = 'MM-MON-KYAIKMARAW' AND (`latitude` IS NULL OR `longitude` IS NULL);
--> statement-breakpoint
UPDATE `agri_locations`
SET `latitude` = '15.96893',
    `longitude` = '97.72745',
    `source` = 'data/master-townships.json; Open-Meteo geocoding',
    `source_date` = '2026-08-14',
    `admin_version` = 'master-townships-v1+open-meteo-geo-v1',
    `updated_by` = 'local-agriculture-gap-pass-1'
WHERE `location_id` = 'MM-MON-THANBYUZAYAT' AND (`latitude` IS NULL OR `longitude` IS NULL);
--> statement-breakpoint
UPDATE `agri_data_gaps`
SET `latest_source_year` = 2026,
    `notes` = 'Open-Meteo geocoding returned a matching Myanmar township administrative label; canonical point is now used for shared weather mapping only, not crop facts.',
    `status` = 'RESOLVED',
    `updated_by` = 'local-agriculture-gap-pass-1'
WHERE `gap_type` IN ('COORDINATES', 'WEATHER_MAPPING')
  AND `location_id` IN ('MM-KYN-KAWKAREIK', 'MM-MON-KYAIKMARAW', 'MM-MON-THANBYUZAYAT');
