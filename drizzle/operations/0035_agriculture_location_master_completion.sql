-- Agriculture location master completion: Local Operations D1 only.
-- Administrative values come from data/master-townships.json. Coordinates are
-- intentionally untouched; NULL remains No Data until a verified coordinate
-- source is added.

UPDATE `agri_locations`
SET `state_region_name` = 'Bago (West)',
    `district_name` = 'Thayarwady',
    `alternate_names` = '["Thayarwady","Tharyawaddy","Tharyarwaddy"]',
    `source` = 'data/master-townships.json',
    `source_date` = NULL,
    `admin_version` = 'master-townships-v1',
    `updated_by` = 'local-agriculture-master-pass'
WHERE `location_id` = 'MM-BGO-THARRAWADDY';
--> statement-breakpoint
UPDATE `agri_locations`
SET `state_region_name` = 'Bago (West)',
    `district_name` = 'Thayarwady',
    `source` = 'data/master-townships.json',
    `source_date` = NULL,
    `admin_version` = 'master-townships-v1',
    `updated_by` = 'local-agriculture-master-pass'
WHERE `location_id` = 'MM-BGO-NATTALIN';
--> statement-breakpoint
UPDATE `agri_locations`
SET `district_name` = 'Mawlamyine',
    `source` = 'data/master-townships.json',
    `source_date` = NULL,
    `admin_version` = 'master-townships-v1',
    `updated_by` = 'local-agriculture-master-pass'
WHERE `location_id` IN ('MM-MON-MAWLAMYINE', 'MM-MON-MUDON', 'MM-MON-KYAIKMARAW', 'MM-MON-THANBYUZAYAT');
--> statement-breakpoint
UPDATE `agri_locations`
SET `alternate_names` = '["Hpa An","Hpa-an","HPA-AN"]',
    `district_name` = 'Hpa-An',
    `source` = 'data/master-townships.json',
    `source_date` = NULL,
    `admin_version` = 'master-townships-v1',
    `updated_by` = 'local-agriculture-master-pass'
WHERE `location_id` = 'MM-KYN-HPAAN';
--> statement-breakpoint
UPDATE `agri_locations`
SET `district_name` = 'Kawkareik',
    `source` = 'data/master-townships.json',
    `source_date` = NULL,
    `admin_version` = 'master-townships-v1',
    `updated_by` = 'local-agriculture-master-pass'
WHERE `location_id` = 'MM-KYN-KAWKAREIK';
--> statement-breakpoint
UPDATE `agri_locations`
SET `district_name` = 'Myawaddy',
    `source` = 'data/master-townships.json',
    `source_date` = NULL,
    `admin_version` = 'master-townships-v1',
    `updated_by` = 'local-agriculture-master-pass'
WHERE `location_id` = 'MM-KYN-MYAWADDY';
