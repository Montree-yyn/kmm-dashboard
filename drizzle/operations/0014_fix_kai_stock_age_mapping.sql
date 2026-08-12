-- KAI Phase 1E runtime-test fix: use verified Stock age fields only.

UPDATE `kai_data_dictionary`
SET `description` = 'แหล่งข้อมูลจริงของอายุ Stock; ถ้ามีค่าให้ใช้ stock_age_days โดยตรง'
WHERE `business_name` = 'Stock Age Days'
	AND `table_name` = 'stock_transactions'
	AND `field_name` = 'stock_age_days';
--> statement-breakpoint
UPDATE `kai_data_dictionary`
SET `description` = 'วันที่เริ่มต้นของการคำนวณอายุ; ใช้ stock_date และ fallback เป็น as_of_date ตอน import'
WHERE `business_name` = 'Stock Date'
	AND `table_name` = 'stock_transactions'
	AND `field_name` = 'stock_date';
--> statement-breakpoint
UPDATE `kai_data_dictionary`
SET `description` = 'วันที่อ้างอิง snapshot ของ Stock และปลายทางของการคำนวณอายุเมื่อไม่มีค่า stock_age_days'
WHERE `business_name` = 'Stock Snapshot Date'
	AND `table_name` = 'stock_transactions'
	AND `field_name` = 'as_of_date';
--> statement-breakpoint
INSERT OR IGNORE INTO `kai_data_dictionary`
	(`business_name`, `table_name`, `field_name`, `data_type`, `description`, `domain`)
VALUES
	('Stock Age Calculation', 'APPLICATION_MAPPING', 'app/api/data-hub/import/route.ts::calculateAgeDays', 'DERIVED_INTEGER', 'ใช้ stock_age_days จาก source ก่อน; ถ้าไม่มี ให้คำนวณ max(0, floor((snapshot_date - stock_date) / 86400000)); stock_date fallback เป็น as_of_date; ไม่มี receive_date ใน schema จริง', 'stock');
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `required_data` = 'stock_age_days, stock_date, as_of_date, snapshot_date, product_model, physical identifiers',
	`query_logic` = 'Apply STOCK_CURRENT scope and WHERE stock_age_days > 90; use source stock_age_days when present, otherwise the verified application mapping derives snapshot_date - stock_date; GROUP BY product_model, ORDER BY COUNT(*) DESC'
WHERE `intent` = 'STOCK_AGING_MODEL';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `required_data` = 'stock_age_days, stock_date, as_of_date, snapshot_date, stock_status, kmm_flag',
	`query_logic` = 'Apply STOCK_CURRENT scope and WHERE stock_age_days > 90; stock_age_days is source-backed or derived by the verified application mapping from snapshot_date - stock_date'
WHERE `intent` = 'STOCK_AGING_QUERY';
--> statement-breakpoint
UPDATE `kai_business_rules`
SET `condition` = 'stock_age_days >= 0 AND stock_age_days <= 90'
WHERE `rule_code` = 'STOCK_AGING_0_90';
--> statement-breakpoint
UPDATE `kai_business_rules`
SET `condition` = 'stock_age_days >= 91 AND stock_age_days <= 180'
WHERE `rule_code` = 'STOCK_AGING_91_180';
--> statement-breakpoint
UPDATE `kai_business_rules`
SET `condition` = 'stock_age_days >= 181 AND stock_age_days <= 365'
WHERE `rule_code` = 'STOCK_AGING_181_365';
--> statement-breakpoint
UPDATE `kai_business_rules`
SET `condition` = 'stock_age_days > 365'
WHERE `rule_code` = 'STOCK_AGING_GT_365';
--> statement-breakpoint
UPDATE `kai_metrics`
SET `formula` = 'Use stock_age_days; when absent, derive max(0, floor((snapshot_date - stock_date) / 86400000)) through the verified application mapping',
	`data_source` = 'OPERATIONS_DB.stock_transactions.stock_age_days, stock_date, as_of_date, snapshot_date + APPLICATION_MAPPING app/api/data-hub/import/route.ts::calculateAgeDays'
WHERE `metric_code` = 'STOCK003';
