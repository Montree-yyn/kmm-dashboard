-- KMM Agriculture Phase 2: official state/region statistical backbone (local Operations D1 only).
-- Source: Central Statistical Organization, Myanmar Statistical Yearbook 2024, Chapter 9, Table 9.12.
-- State/Region records remain separate from township facts; no yield is derived from area/production.

ALTER TABLE `agri_locations` ADD COLUMN `geography_level` text DEFAULT 'TOWNSHIP' NOT NULL;
--> statement-breakpoint
ALTER TABLE `agri_sources` ADD COLUMN `source_table` text;
--> statement-breakpoint
ALTER TABLE `agri_crop_statistics` ADD COLUMN `sown_area` real;
--> statement-breakpoint
ALTER TABLE `agri_crop_statistics` ADD COLUMN `sown_area_unit` text;
--> statement-breakpoint
ALTER TABLE `agri_crop_statistics` ADD COLUMN `harvested_area` real;
--> statement-breakpoint
ALTER TABLE `agri_crop_statistics` ADD COLUMN `harvested_area_unit` text;
--> statement-breakpoint
ALTER TABLE `agri_crop_statistics` ADD COLUMN `source_table` text;
--> statement-breakpoint
ALTER TABLE `agri_crop_statistics` ADD COLUMN `source_crop_name` text;
--> statement-breakpoint
ALTER TABLE `agri_crop_statistics` ADD COLUMN `geography_level` text DEFAULT 'TOWNSHIP' NOT NULL;
--> statement-breakpoint
UPDATE `agri_crop_statistics` SET `geography_level` = `source_geography` WHERE `geography_level` = 'TOWNSHIP' AND `source_geography` <> 'TOWNSHIP';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_locations_geography_idx` ON `agri_locations` (`geography_level`, `state_region_code`, `is_active`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_statistics_geography_idx` ON `agri_crop_statistics` (`geography_level`, `location_id`, `crop_year`, `crop_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agri_crop_statistics_geography_year_unique` ON `agri_crop_statistics` (`location_id`, `crop_id`, `crop_year`, `source_geography`) WHERE `source_geography` = 'STATE_REGION';
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crops` (`crop_id`, `crop_code`, `crop_name`, `crop_cycle_type`, `alternate_names`, `created_by`, `updated_by`) VALUES
  ('crop-sugarcane', 'SUGARCANE', 'Sugarcane', 'PERENNIAL', '["Sugar cane"]', 'local-agriculture-state-region-pass2', 'local-agriculture-state-region-pass2');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_sources` (`source_id`, `source_name`, `source_type`, `publisher`, `publication_date`, `source_geography`, `source_table`, `reference_uri`, `reliability_grade`, `notes`, `created_by`, `updated_by`) VALUES
  ('source-cso-msyb-2024-agri-9-12', 'Myanmar Statistical Yearbook 2024 · Agriculture Table 9.12', 'OFFICIAL_STATISTICS', 'Central Statistical Organization, Myanmar · Settlement and Land Records Department', NULL, 'STATE_REGION', '9.12', 'https://csostat.gov.mm/FileUpload/cso/FileDownload/MSYB%202024%20-%20Part-2.pdf', 'V4', 'Publication year 2024. Sown Acreage, Harvested Acreage and Production of Selected Crops by States and Regions, 2019/2020–2023/2024. Source unit is Acre for area and Ton for production; agriculture year runs 1 July–30 June. Canonical mappings are stored on each statistic record.', 'local-agriculture-state-region-pass2', 'local-agriculture-state-region-pass2'),
  ('source-cso-msyb-2024-agri-9-15', 'Myanmar Statistical Yearbook 2024 · Agriculture Table 9.15', 'OFFICIAL_STATISTICS', 'Central Statistical Organization, Myanmar · Settlement and Land Records Department', NULL, 'NATIONAL', '9.15', 'https://csostat.gov.mm/FileUpload/cso/FileDownload/MSYB%202024%20-%20Part-2.pdf', 'V4', 'Publication year 2024. Yield per Harvested Acre is Union-level in this table; no state/region yield records are loaded and no yield is derived.', 'local-agriculture-state-region-pass2', 'local-agriculture-state-region-pass2');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_locations` (`location_id`, `country_code`, `state_region_code`, `state_region_name`, `district_code`, `district_name`, `township_code`, `township_name`, `canonical_name`, `alternate_names`, `myanmar_name`, `latitude`, `longitude`, `admin_version`, `source`, `source_date`, `kmm_branch_code`, `sales_territory_id`, `is_active`, `valid_from`, `valid_to`, `geography_level`, `created_by`, `updated_by`) VALUES
  ('MM-REG-BAGO', 'MM', 'BGO', 'Bago', NULL, NULL, NULL, NULL, 'Bago Region', '[\"Bago\",\"Pegu\"]', NULL, NULL, NULL, 'CSO-MSYB-2024', 'Central Statistical Organization, Myanmar Statistical Yearbook 2024', NULL, NULL, NULL, 1, NULL, NULL, 'STATE_REGION', 'local-agriculture-state-region-pass2', 'local-agriculture-state-region-pass2'),
  ('MM-STATE-MON', 'MM', 'MON', 'Mon', NULL, NULL, NULL, NULL, 'Mon State', '[\"Mon\",\"Mon State\"]', NULL, NULL, NULL, 'CSO-MSYB-2024', 'Central Statistical Organization, Myanmar Statistical Yearbook 2024', NULL, NULL, NULL, 1, NULL, NULL, 'STATE_REGION', 'local-agriculture-state-region-pass2', 'local-agriculture-state-region-pass2'),
  ('MM-STATE-KAYIN', 'MM', 'KYN', 'Kayin', NULL, NULL, NULL, NULL, 'Kayin State', '[\"Kayin\",\"Karen\"]', NULL, NULL, NULL, 'CSO-MSYB-2024', 'Central Statistical Organization, Myanmar Statistical Yearbook 2024', NULL, NULL, NULL, 1, NULL, NULL, 'STATE_REGION', 'local-agriculture-state-region-pass2', 'local-agriculture-state-region-pass2');
--> statement-breakpoint
WITH seed(statistic_id, location_id, crop_code, crop_year, season_code, sown_area, harvested_area, production, source_crop_name, notes) AS (
VALUES
  ('stat-cso-msyb2024-bago-rice-2019', 'MM-REG-BAGO', 'RICE', 2019, '2019/20', 2987791, 2923455, 4685779, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-bago-rice-2020', 'MM-REG-BAGO', 'RICE', 2020, '2020/21', 2967360, 2953168, 4732549, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-bago-rice-2021', 'MM-REG-BAGO', 'RICE', 2021, '2021/22', 3020108, 3019710, 4892861, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-bago-rice-2022', 'MM-REG-BAGO', 'RICE', 2022, '2022/23', 3079966, 3079948, 5065546, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-bago-rice-2023', 'MM-REG-BAGO', 'RICE', 2023, '2023/24', 3123616, 3116760, 5925421, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-bago-maize-2019', 'MM-REG-BAGO', 'MAIZE', 2019, '2019/20', 12996, 12996, 24316, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-bago-maize-2020', 'MM-REG-BAGO', 'MAIZE', 2020, '2020/21', 10522, 10522, 19646, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-bago-maize-2021', 'MM-REG-BAGO', 'MAIZE', 2021, '2021/22', 10858, 10858, 20152, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-bago-maize-2022', 'MM-REG-BAGO', 'MAIZE', 2022, '2022/23', 12161, 12161, 21445, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-bago-maize-2023', 'MM-REG-BAGO', 'MAIZE', 2023, '2023/24', 45876, 45826, 100417, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-bago-groundnut-2019', 'MM-REG-BAGO', 'GROUNDNUT', 2019, '2019/20', 187076, 187022, 131592, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-groundnut-2020', 'MM-REG-BAGO', 'GROUNDNUT', 2020, '2020/21', 182887, 182602, 128966, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-groundnut-2021', 'MM-REG-BAGO', 'GROUNDNUT', 2021, '2021/22', 197578, 197578, 139582, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-groundnut-2022', 'MM-REG-BAGO', 'GROUNDNUT', 2022, '2022/23', 200024, 200003, 142864, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-groundnut-2023', 'MM-REG-BAGO', 'GROUNDNUT', 2023, '2023/24', 267638, 267638, 230079, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-sesame-2019', 'MM-REG-BAGO', 'SESAME', 2019, '2019/20', 149454, 148808, 37772, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-sesame-2020', 'MM-REG-BAGO', 'SESAME', 2020, '2020/21', 165603, 162951, 40951, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-sesame-2021', 'MM-REG-BAGO', 'SESAME', 2021, '2021/22', 166733, 166733, 42150, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-sesame-2022', 'MM-REG-BAGO', 'SESAME', 2022, '2022/23', 171565, 171565, 43726, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-sesame-2023', 'MM-REG-BAGO', 'SESAME', 2023, '2023/24', 233649, 233649, 92184, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-sunflower-2019', 'MM-REG-BAGO', 'SUNFLOWER', 2019, '2019/20', 496, 496, 116, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-bago-sunflower-2020', 'MM-REG-BAGO', 'SUNFLOWER', 2020, '2020/21', 458, 458, 112, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-bago-sunflower-2021', 'MM-REG-BAGO', 'SUNFLOWER', 2021, '2021/22', 5850, 5850, 1426, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-bago-sunflower-2022', 'MM-REG-BAGO', 'SUNFLOWER', 2022, '2022/23', 86731, 86725, 19876, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-bago-sunflower-2023', 'MM-REG-BAGO', 'SUNFLOWER', 2023, '2023/24', 51373, 51366, 15179, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-bago-black_gram-2019', 'MM-REG-BAGO', 'BLACK_GRAM', 2019, '2019/20', 1035292, 1035266, 453558, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-bago-black_gram-2020', 'MM-REG-BAGO', 'BLACK_GRAM', 2020, '2020/21', 994089, 994082, 437983, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-bago-black_gram-2021', 'MM-REG-BAGO', 'BLACK_GRAM', 2021, '2021/22', 972436, 972434, 433230, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-bago-black_gram-2022', 'MM-REG-BAGO', 'BLACK_GRAM', 2022, '2022/23', 1012916, 1012916, 456073, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-bago-black_gram-2023', 'MM-REG-BAGO', 'BLACK_GRAM', 2023, '2023/24', 1069704, 1069704, 640343, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-bago-green_gram-2019', 'MM-REG-BAGO', 'GREEN_GRAM', 2019, '2019/20', 729336, 729317, 331127, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-bago-green_gram-2020', 'MM-REG-BAGO', 'GREEN_GRAM', 2020, '2020/21', 771678, 771389, 350223, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-bago-green_gram-2021', 'MM-REG-BAGO', 'GREEN_GRAM', 2021, '2021/22', 803397, 803180, 364475, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-bago-green_gram-2022', 'MM-REG-BAGO', 'GREEN_GRAM', 2022, '2022/23', 857182, 857182, 390775, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-bago-green_gram-2023', 'MM-REG-BAGO', 'GREEN_GRAM', 2023, '2023/24', 1002804, 1002804, 527335, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-bago-sugarcane-2019', 'MM-REG-BAGO', 'SUGARCANE', 2019, '2019/20', 58060, 58060, 1541897, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-bago-sugarcane-2020', 'MM-REG-BAGO', 'SUGARCANE', 2020, '2020/21', 53781, 53781, 1413587, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-bago-sugarcane-2021', 'MM-REG-BAGO', 'SUGARCANE', 2021, '2021/22', 48293, 48293, 1291498, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-bago-sugarcane-2022', 'MM-REG-BAGO', 'SUGARCANE', 2022, '2022/23', 49524, 49524, 1332806, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-bago-sugarcane-2023', 'MM-REG-BAGO', 'SUGARCANE', 2023, '2023/24', 52952, 52952, 1809446, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-bago-vegetables-2019', 'MM-REG-BAGO', 'VEGETABLES', 2019, '2019/20', 14847, 134299, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-vegetables-2020', 'MM-REG-BAGO', 'VEGETABLES', 2020, '2020/21', 14938, 14938, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-vegetables-2021', 'MM-REG-BAGO', 'VEGETABLES', 2021, '2021/22', 14998, 14998, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-vegetables-2022', 'MM-REG-BAGO', 'VEGETABLES', 2022, '2022/23', 16013, 15983, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-vegetables-2023', 'MM-REG-BAGO', 'VEGETABLES', 2023, '2023/24', 16071, 16041, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-fruits-2019', 'MM-REG-BAGO', 'FRUITS', 2019, '2019/20', 134377, 178482, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-fruits-2020', 'MM-REG-BAGO', 'FRUITS', 2020, '2020/21', 127517, 189767, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-fruits-2021', 'MM-REG-BAGO', 'FRUITS', 2021, '2021/22', 125954, 187262, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-fruits-2022', 'MM-REG-BAGO', 'FRUITS', 2022, '2022/23', 120515, 187485, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-fruits-2023', 'MM-REG-BAGO', 'FRUITS', 2023, '2023/24', 224295, 189292, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-bago-rubber-2019', 'MM-REG-BAGO', 'RUBBER', 2019, '2019/20', 118046, 52778, 16659, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-bago-rubber-2020', 'MM-REG-BAGO', 'RUBBER', 2020, '2020/21', 118042, 53631, 16927, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-bago-rubber-2021', 'MM-REG-BAGO', 'RUBBER', 2021, '2021/22', 118042, 57222, 17584, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-bago-rubber-2022', 'MM-REG-BAGO', 'RUBBER', 2022, '2022/23', 117189, 56766, 17635, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-bago-rubber-2023', 'MM-REG-BAGO', 'RUBBER', 2023, '2023/24', 117219, 58848, 18344, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-bago-cotton-2019', 'MM-REG-BAGO', 'COTTON', 2019, '2019/20', 16208, 16102, 5256, 'Cotton (Wagyi) + Cotton (Long Staple)', 'Cotton (Wagyi) + Cotton (Long Staple) aggregated to canonical COTTON; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-cotton-2020', 'MM-REG-BAGO', 'COTTON', 2020, '2020/21', 14026, 14026, 3885, 'Cotton (Wagyi) + Cotton (Long Staple)', 'Cotton (Wagyi) + Cotton (Long Staple) aggregated to canonical COTTON; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-cotton-2021', 'MM-REG-BAGO', 'COTTON', 2021, '2021/22', 11825, 11825, 3791, 'Cotton (Wagyi) + Cotton (Long Staple)', 'Cotton (Wagyi) + Cotton (Long Staple) aggregated to canonical COTTON; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-cotton-2022', 'MM-REG-BAGO', 'COTTON', 2022, '2022/23', 11482, 11482, 6593, 'Cotton (Wagyi) + Cotton (Long Staple)', 'Cotton (Wagyi) + Cotton (Long Staple) aggregated to canonical COTTON; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-bago-cotton-2023', 'MM-REG-BAGO', 'COTTON', 2023, '2023/24', 14935, 14935, 15210, 'Cotton (Wagyi) + Cotton (Long Staple)', 'Cotton (Wagyi) + Cotton (Long Staple) aggregated to canonical COTTON; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-rice-2019', 'MM-STATE-MON', 'RICE', 2019, '2019/20', 722892, 700545, 886594, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-mon-rice-2020', 'MM-STATE-MON', 'RICE', 2020, '2020/21', 728266, 727544, 949056, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-mon-rice-2021', 'MM-STATE-MON', 'RICE', 2021, '2021/22', 731400, 730922, 958863, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-mon-rice-2022', 'MM-STATE-MON', 'RICE', 2022, '2022/23', 741238, 741238, 981179, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-mon-rice-2023', 'MM-STATE-MON', 'RICE', 2023, '2023/24', 744964, 732964, 997921, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-mon-maize-2020', 'MM-STATE-MON', 'MAIZE', 2020, '2020/21', 5, 5, 9, 'Maize', 'Direct CSO crop label Maize; dash cells are not loaded as zero.'),
  ('stat-cso-msyb2024-mon-maize-2021', 'MM-STATE-MON', 'MAIZE', 2021, '2021/22', 2, 2, 3, 'Maize', 'Direct CSO crop label Maize; dash cells are not loaded as zero.'),
  ('stat-cso-msyb2024-mon-maize-2023', 'MM-STATE-MON', 'MAIZE', 2023, '2023/24', 25, 25, 33, 'Maize', 'Direct CSO crop label Maize; dash cells are not loaded as zero.'),
  ('stat-cso-msyb2024-mon-groundnut-2019', 'MM-STATE-MON', 'GROUNDNUT', 2019, '2019/20', 18811, 18811, 11475, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-groundnut-2020', 'MM-STATE-MON', 'GROUNDNUT', 2020, '2020/21', 17195, 17195, 11101, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-groundnut-2021', 'MM-STATE-MON', 'GROUNDNUT', 2021, '2021/22', 17866, 17866, 11344, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-groundnut-2022', 'MM-STATE-MON', 'GROUNDNUT', 2022, '2022/23', 19068, 19068, 12149, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-groundnut-2023', 'MM-STATE-MON', 'GROUNDNUT', 2023, '2023/24', 20048, 20048, 13893, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-sesame-2019', 'MM-STATE-MON', 'SESAME', 2019, '2019/20', 2672, 2672, 730, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-sesame-2020', 'MM-STATE-MON', 'SESAME', 2020, '2020/21', 2000, 2000, 548, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-sesame-2021', 'MM-STATE-MON', 'SESAME', 2021, '2021/22', 2074, 2074, 580, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-sesame-2022', 'MM-STATE-MON', 'SESAME', 2022, '2022/23', 1840, 1840, 499, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-sesame-2023', 'MM-STATE-MON', 'SESAME', 2023, '2023/24', 2127, 2127, 601, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-mon-sunflower-2019', 'MM-STATE-MON', 'SUNFLOWER', 2019, '2019/20', 77, 77, 30, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-mon-sunflower-2020', 'MM-STATE-MON', 'SUNFLOWER', 2020, '2020/21', 200, 200, 80, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-mon-sunflower-2021', 'MM-STATE-MON', 'SUNFLOWER', 2021, '2021/22', 922, 922, 337, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-mon-sunflower-2022', 'MM-STATE-MON', 'SUNFLOWER', 2022, '2022/23', 6527, 6527, 1040, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-mon-sunflower-2023', 'MM-STATE-MON', 'SUNFLOWER', 2023, '2023/24', 10802, 10802, 1860, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-mon-black_gram-2019', 'MM-STATE-MON', 'BLACK_GRAM', 2019, '2019/20', 5242, 5242, 1559, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-mon-black_gram-2020', 'MM-STATE-MON', 'BLACK_GRAM', 2020, '2020/21', 5619, 5619, 1703, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-mon-black_gram-2021', 'MM-STATE-MON', 'BLACK_GRAM', 2021, '2021/22', 6356, 6356, 1883, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-mon-black_gram-2022', 'MM-STATE-MON', 'BLACK_GRAM', 2022, '2022/23', 6914, 6914, 2242, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-mon-black_gram-2023', 'MM-STATE-MON', 'BLACK_GRAM', 2023, '2023/24', 8540, 8540, 2822, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-mon-green_gram-2019', 'MM-STATE-MON', 'GREEN_GRAM', 2019, '2019/20', 38126, 38126, 12965, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-mon-green_gram-2020', 'MM-STATE-MON', 'GREEN_GRAM', 2020, '2020/21', 40596, 40596, 13708, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-mon-green_gram-2021', 'MM-STATE-MON', 'GREEN_GRAM', 2021, '2021/22', 42606, 42606, 14649, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-mon-green_gram-2022', 'MM-STATE-MON', 'GREEN_GRAM', 2022, '2022/23', 45334, 45334, 15784, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-mon-green_gram-2023', 'MM-STATE-MON', 'GREEN_GRAM', 2023, '2023/24', 48063, 48063, 17104, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-mon-sugarcane-2019', 'MM-STATE-MON', 'SUGARCANE', 2019, '2019/20', 1483, 1413, 31431, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-mon-sugarcane-2020', 'MM-STATE-MON', 'SUGARCANE', 2020, '2020/21', 1429, 1429, 21027, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-mon-sugarcane-2021', 'MM-STATE-MON', 'SUGARCANE', 2021, '2021/22', 287, 287, 4897, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-mon-sugarcane-2022', 'MM-STATE-MON', 'SUGARCANE', 2022, '2022/23', 125, 125, 1710, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-mon-sugarcane-2023', 'MM-STATE-MON', 'SUGARCANE', 2023, '2023/24', 124, 124, 1681, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-mon-vegetables-2019', 'MM-STATE-MON', 'VEGETABLES', 2019, '2019/20', 38065, 38065, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-vegetables-2020', 'MM-STATE-MON', 'VEGETABLES', 2020, '2020/21', 38654, 38654, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-vegetables-2021', 'MM-STATE-MON', 'VEGETABLES', 2021, '2021/22', 39016, 39016, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-vegetables-2022', 'MM-STATE-MON', 'VEGETABLES', 2022, '2022/23', 39694, 39694, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-vegetables-2023', 'MM-STATE-MON', 'VEGETABLES', 2023, '2023/24', 40073, 40073, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-fruits-2019', 'MM-STATE-MON', 'FRUITS', 2019, '2019/20', 166789, 133774, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-fruits-2020', 'MM-STATE-MON', 'FRUITS', 2020, '2020/21', 166789, 132808, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-fruits-2021', 'MM-STATE-MON', 'FRUITS', 2021, '2021/22', 166793, 123148, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-fruits-2022', 'MM-STATE-MON', 'FRUITS', 2022, '2022/23', 167114, 120593, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-fruits-2023', 'MM-STATE-MON', 'FRUITS', 2023, '2023/24', 167265, 127837, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-mon-rubber-2019', 'MM-STATE-MON', 'RUBBER', 2019, '2019/20', 497485, 328500, 107917, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-mon-rubber-2020', 'MM-STATE-MON', 'RUBBER', 2020, '2020/21', 502141, 328722, 106783, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-mon-rubber-2021', 'MM-STATE-MON', 'RUBBER', 2021, '2021/22', 501719, 330014, 105783, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-mon-rubber-2022', 'MM-STATE-MON', 'RUBBER', 2022, '2022/23', 504988, 340389, 112150, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-mon-rubber-2023', 'MM-STATE-MON', 'RUBBER', 2023, '2023/24', 506444, 362225, 120554, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-kayin-rice-2019', 'MM-STATE-KAYIN', 'RICE', 2019, '2019/20', 544960, 543910, 784000, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-kayin-rice-2020', 'MM-STATE-KAYIN', 'RICE', 2020, '2020/21', 544080, 544080, 784497, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-kayin-rice-2021', 'MM-STATE-KAYIN', 'RICE', 2021, '2021/22', 543270, 543270, 785722, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-kayin-rice-2022', 'MM-STATE-KAYIN', 'RICE', 2022, '2022/23', 539266, 539266, 780430, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-kayin-rice-2023', 'MM-STATE-KAYIN', 'RICE', 2023, '2023/24', 541106, 541106, 788274, 'Paddy', 'Paddy mapped to canonical RICE.'),
  ('stat-cso-msyb2024-kayin-maize-2019', 'MM-STATE-KAYIN', 'MAIZE', 2019, '2019/20', 53128, 52793, 114992, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-kayin-maize-2020', 'MM-STATE-KAYIN', 'MAIZE', 2020, '2020/21', 53076, 53063, 115564, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-kayin-maize-2021', 'MM-STATE-KAYIN', 'MAIZE', 2021, '2021/22', 53078, 52990, 115404, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-kayin-maize-2022', 'MM-STATE-KAYIN', 'MAIZE', 2022, '2022/23', 52485, 52485, 114371, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-kayin-maize-2023', 'MM-STATE-KAYIN', 'MAIZE', 2023, '2023/24', 52334, 52334, 114074, 'Maize', 'Direct CSO crop label Maize.'),
  ('stat-cso-msyb2024-kayin-groundnut-2019', 'MM-STATE-KAYIN', 'GROUNDNUT', 2019, '2019/20', 36188, 36188, 26934, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-groundnut-2020', 'MM-STATE-KAYIN', 'GROUNDNUT', 2020, '2020/21', 36195, 36195, 27007, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-groundnut-2021', 'MM-STATE-KAYIN', 'GROUNDNUT', 2021, '2021/22', 36157, 36157, 27014, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-groundnut-2022', 'MM-STATE-KAYIN', 'GROUNDNUT', 2022, '2022/23', 35064, 35064, 26022, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-groundnut-2023', 'MM-STATE-KAYIN', 'GROUNDNUT', 2023, '2023/24', 35515, 35515, 26436, 'Groundnut (Rain) + Groundnut (Winter)', 'Groundnut (Rain) + Groundnut (Winter) aggregated to canonical GROUNDNUT; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-sesame-2019', 'MM-STATE-KAYIN', 'SESAME', 2019, '2019/20', 45206, 45206, 14810, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-sesame-2020', 'MM-STATE-KAYIN', 'SESAME', 2020, '2020/21', 45204, 45204, 14833, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-sesame-2021', 'MM-STATE-KAYIN', 'SESAME', 2021, '2021/22', 45136, 45136, 14871, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-sesame-2022', 'MM-STATE-KAYIN', 'SESAME', 2022, '2022/23', 45477, 45477, 14972, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-sesame-2023', 'MM-STATE-KAYIN', 'SESAME', 2023, '2023/24', 45765, 45765, 15114, 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer)', 'Sesamum (Early) + Sesamum (Late) + Sesamum (Summer) aggregated to canonical SESAME; no acre/hectare conversion.'),
  ('stat-cso-msyb2024-kayin-sunflower-2019', 'MM-STATE-KAYIN', 'SUNFLOWER', 2019, '2019/20', 174, 174, 62, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-kayin-sunflower-2020', 'MM-STATE-KAYIN', 'SUNFLOWER', 2020, '2020/21', 165, 165, 59, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-kayin-sunflower-2021', 'MM-STATE-KAYIN', 'SUNFLOWER', 2021, '2021/22', 164, 164, 59, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-kayin-sunflower-2022', 'MM-STATE-KAYIN', 'SUNFLOWER', 2022, '2022/23', 2254, 2254, 503, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-kayin-sunflower-2023', 'MM-STATE-KAYIN', 'SUNFLOWER', 2023, '2023/24', 3445, 3445, 766, 'Sunflower', 'Direct CSO crop label Sunflower.'),
  ('stat-cso-msyb2024-kayin-black_gram-2019', 'MM-STATE-KAYIN', 'BLACK_GRAM', 2019, '2019/20', 1725, 1725, 609, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-kayin-black_gram-2020', 'MM-STATE-KAYIN', 'BLACK_GRAM', 2020, '2020/21', 1727, 1727, 606, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-kayin-black_gram-2021', 'MM-STATE-KAYIN', 'BLACK_GRAM', 2021, '2021/22', 1705, 1705, 601, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-kayin-black_gram-2022', 'MM-STATE-KAYIN', 'BLACK_GRAM', 2022, '2022/23', 1645, 1645, 585, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-kayin-black_gram-2023', 'MM-STATE-KAYIN', 'BLACK_GRAM', 2023, '2023/24', 1686, 1686, 599, 'Matpe (Black gram)', 'Matpe (Black gram) mapped to canonical BLACK_GRAM.'),
  ('stat-cso-msyb2024-kayin-green_gram-2019', 'MM-STATE-KAYIN', 'GREEN_GRAM', 2019, '2019/20', 68409, 68409, 27674, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-kayin-green_gram-2020', 'MM-STATE-KAYIN', 'GREEN_GRAM', 2020, '2020/21', 68375, 68375, 27685, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-kayin-green_gram-2021', 'MM-STATE-KAYIN', 'GREEN_GRAM', 2021, '2021/22', 68389, 68389, 27722, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-kayin-green_gram-2022', 'MM-STATE-KAYIN', 'GREEN_GRAM', 2022, '2022/23', 67957, 67957, 27605, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-kayin-green_gram-2023', 'MM-STATE-KAYIN', 'GREEN_GRAM', 2023, '2023/24', 68181, 68181, 27762, 'Pedisein (Green gram)', 'Pedisein (Green gram) mapped to canonical GREEN_GRAM.'),
  ('stat-cso-msyb2024-kayin-sugarcane-2019', 'MM-STATE-KAYIN', 'SUGARCANE', 2019, '2019/20', 6143, 6143, 150534, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-kayin-sugarcane-2020', 'MM-STATE-KAYIN', 'SUGARCANE', 2020, '2020/21', 5952, 5952, 147277, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-kayin-sugarcane-2021', 'MM-STATE-KAYIN', 'SUGARCANE', 2021, '2021/22', 5952, 5952, 146643, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-kayin-sugarcane-2022', 'MM-STATE-KAYIN', 'SUGARCANE', 2022, '2022/23', 5952, 5952, 146918, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-kayin-sugarcane-2023', 'MM-STATE-KAYIN', 'SUGARCANE', 2023, '2023/24', 5948, 5948, 146499, 'Sugarcane', 'Direct CSO crop label Sugarcane.'),
  ('stat-cso-msyb2024-kayin-vegetables-2019', 'MM-STATE-KAYIN', 'VEGETABLES', 2019, '2019/20', 30914, 30914, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-vegetables-2020', 'MM-STATE-KAYIN', 'VEGETABLES', 2020, '2020/21', 31888, 31888, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-vegetables-2021', 'MM-STATE-KAYIN', 'VEGETABLES', 2021, '2021/22', 31858, 31858, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-vegetables-2022', 'MM-STATE-KAYIN', 'VEGETABLES', 2022, '2022/23', 32010, 32010, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-vegetables-2023', 'MM-STATE-KAYIN', 'VEGETABLES', 2023, '2023/24', 32015, 32015, NULL, 'Vegetables', 'Direct CSO crop label Vegetables; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-fruits-2019', 'MM-STATE-KAYIN', 'FRUITS', 2019, '2019/20', 116578, 82306, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-fruits-2020', 'MM-STATE-KAYIN', 'FRUITS', 2020, '2020/21', 116593, 82747, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-fruits-2021', 'MM-STATE-KAYIN', 'FRUITS', 2021, '2021/22', 116593, 82737, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-fruits-2022', 'MM-STATE-KAYIN', 'FRUITS', 2022, '2022/23', 116593, 82737, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-fruits-2023', 'MM-STATE-KAYIN', 'FRUITS', 2023, '2023/24', 116593, 82755, NULL, 'Fruits', 'Direct CSO crop label Fruits; production is not reported in Table 9.12.'),
  ('stat-cso-msyb2024-kayin-rubber-2019', 'MM-STATE-KAYIN', 'RUBBER', 2019, '2019/20', 271096, 197606, 63569, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-kayin-rubber-2020', 'MM-STATE-KAYIN', 'RUBBER', 2020, '2020/21', 271111, 211885, 66601, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-kayin-rubber-2021', 'MM-STATE-KAYIN', 'RUBBER', 2021, '2021/22', 271111, 260386, 73407, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-kayin-rubber-2022', 'MM-STATE-KAYIN', 'RUBBER', 2022, '2022/23', 271271, 260661, 80940, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.'),
  ('stat-cso-msyb2024-kayin-rubber-2023', 'MM-STATE-KAYIN', 'RUBBER', 2023, '2023/24', 271279, 260829, 81425, 'Rubber', 'Direct CSO crop label Rubber; state actual from Table 9.12.')
)
INSERT OR IGNORE INTO `agri_crop_statistics` (
  `statistic_id`, `location_id`, `crop_id`, `crop_year`, `season_code`,
  `cultivated_area`, `area_unit`, `production`, `production_unit`, `yield`, `yield_unit`,
  `sown_area`, `sown_area_unit`, `harvested_area`, `harvested_area_unit`,
  `source_id`, `source_table`, `source_crop_name`, `source_geography`, `geography_level`,
  `source_year`, `record_type`, `value_qualifier`, `verification_status`, `confidence_score`,
  `notes`, `created_by`, `updated_by`
)
SELECT
  seed.statistic_id, locations.location_id, crops.crop_id, seed.crop_year, seed.season_code,
  NULL, 'Acre', seed.production, CASE WHEN seed.production IS NULL THEN NULL ELSE 'Ton' END, NULL, NULL,
  seed.sown_area, 'Acre', seed.harvested_area, 'Acre',
  'source-cso-msyb-2024-agri-9-12', '9.12', seed.source_crop_name, 'STATE_REGION', 'STATE_REGION',
  2024, 'ACTUAL', 'EXACT', 'V4', 100,
  seed.notes, 'local-agriculture-state-region-pass2', 'local-agriculture-state-region-pass2'
FROM seed
JOIN `agri_locations` locations ON locations.location_id = seed.location_id AND locations.geography_level = 'STATE_REGION'
JOIN `agri_crops` crops ON crops.crop_code = seed.crop_code;
--> statement-breakpoint
UPDATE `agri_sources`
SET `source_table` = CASE
  WHEN `source_id` = 'source-cso-msyb-2024-agri-9-12' THEN '9.12'
  WHEN `source_id` = 'source-cso-msyb-2024-agri-9-15' THEN '9.15'
  ELSE `source_table`
END,
`updated_by` = 'local-agriculture-state-region-pass2'
WHERE `source_id` IN ('source-cso-msyb-2024-agri-9-12', 'source-cso-msyb-2024-agri-9-15');
