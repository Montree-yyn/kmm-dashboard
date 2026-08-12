-- Manual rollback for the Phase 1E runtime-test fix.
-- Run only before the standardized rows and aliases are consumed by a later phase.

UPDATE `kai_data_dictionary`
SET `description` = 'อายุ Stock ที่ source นำเข้าไว้'
WHERE `business_name` = 'Stock Age Days'
	AND `table_name` = 'stock_transactions'
	AND `field_name` = 'stock_age_days';
--> statement-breakpoint
UPDATE `kai_data_dictionary`
SET `description` = 'วันที่ Stock จาก source'
WHERE `business_name` = 'Stock Date'
	AND `table_name` = 'stock_transactions'
	AND `field_name` = 'stock_date';
--> statement-breakpoint
UPDATE `kai_data_dictionary`
SET `description` = 'วันที่อ้างอิง snapshot Stock'
WHERE `business_name` = 'Stock Snapshot Date'
	AND `table_name` = 'stock_transactions'
	AND `field_name` = 'as_of_date';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `required_data` = 'product_model, stock_age_days, physical identifiers',
	`query_logic` = 'Apply STOCK_AGING_QUERY, GROUP BY product_model, ORDER BY COUNT(*) DESC'
WHERE `intent` = 'STOCK_AGING_MODEL';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `required_data` = 'stock_age_days, stock_status, kmm_flag',
	`query_logic` = 'Apply STOCK_CURRENT scope and WHERE stock_age_days > 90; GROUP BY product_model when a model breakdown is requested'
WHERE `intent` = 'STOCK_AGING_QUERY';
--> statement-breakpoint
UPDATE `kai_business_rules`
SET `condition` = 'age_days >= 0 AND age_days <= 90'
WHERE `rule_code` = 'STOCK_AGING_0_90';
--> statement-breakpoint
UPDATE `kai_business_rules`
SET `condition` = 'age_days >= 91 AND age_days <= 180'
WHERE `rule_code` = 'STOCK_AGING_91_180';
--> statement-breakpoint
UPDATE `kai_business_rules`
SET `condition` = 'age_days >= 181 AND age_days <= 365'
WHERE `rule_code` = 'STOCK_AGING_181_365';
--> statement-breakpoint
UPDATE `kai_business_rules`
SET `condition` = 'age_days > 365'
WHERE `rule_code` = 'STOCK_AGING_GT_365';
--> statement-breakpoint
UPDATE `kai_metrics`
SET `formula` = 'stock_age_days',
	`data_source` = 'OPERATIONS_DB.stock_transactions.stock_age_days, stock_date, as_of_date'
WHERE `metric_code` = 'STOCK003';
--> statement-breakpoint
DELETE FROM `kai_alias_mapping`
WHERE `alias_word` IN (
	'ยอดขายเดือนนี้',
	'เดือนนี้ขายได้กี่คัน',
	'Sales เดือนนี้',
	'ยอดขายปัจจุบัน',
	'ยอดขายเดือน 5 ปี 2023 เทียบกับปีนี้เป็นอย่างไร',
	'เดือนนี้จองเท่าไหร่',
	'ยอดจองเดือนนี้',
	'Booking ปัจจุบัน',
	'Booking เกิน 90 วันมีกี่คัน',
	'รถอายุเกิน 90 วัน',
	'Stock เกิน 90 วัน'
);
--> statement-breakpoint
DELETE FROM `kai_question_library`
WHERE `question` IN (
	'ยอดขายเดือนนี้',
	'Sales เดือนนี้',
	'ยอดขายปัจจุบัน',
	'ยอดขายเดือน 5 ปี 2023 เทียบกับปีนี้เป็นอย่างไร',
	'ยอดจองเดือนนี้',
	'Booking ปัจจุบัน',
	'Booking เกิน 90 วันมีกี่คัน',
	'รถค้าง',
	'Stock เกิน 90 วัน',
	'รถอายุเกิน 90 วัน'
);
--> statement-breakpoint
UPDATE `kai_alias_mapping`
SET `canonical_term` = CASE WHEN `alias_word` IN ('รถค้าง', 'เกิน 90 วัน') THEN CASE WHEN `alias_word` = 'รถค้าง' THEN 'Stock Aging' ELSE 'Aging' END ELSE `canonical_term` END,
	`intent` = CASE
		WHEN `intent` = 'SALES_CURRENT_MONTH' THEN 'SALES_CURRENT'
		WHEN `intent` = 'BOOKING_CURRENT_MONTH' THEN 'BOOKING_CURRENT'
		WHEN `intent` = 'STOCK_AGING_MODEL' THEN 'STOCK_AGING_QUERY'
		ELSE `intent`
	END
WHERE `intent` IN ('SALES_CURRENT_MONTH', 'BOOKING_CURRENT_MONTH', 'STOCK_AGING_MODEL');
--> statement-breakpoint
UPDATE `kai_question_library`
SET `intent` = 'SALES_CURRENT'
WHERE `intent` = 'SALES_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `intent` = 'SALES_CURRENT'
WHERE `intent` = 'SALES_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_response_templates`
SET `intent` = 'SALES_CURRENT'
WHERE `intent` = 'SALES_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_question_library`
SET `intent` = 'BOOKING_CURRENT'
WHERE `intent` = 'BOOKING_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `intent` = 'BOOKING_CURRENT'
WHERE `intent` = 'BOOKING_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_response_templates`
SET `intent` = 'BOOKING_CURRENT'
WHERE `intent` = 'BOOKING_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_question_library`
SET `intent` = 'BOOKING_AGING_QUERY'
WHERE `intent` = 'BOOKING_AGING';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `intent` = 'BOOKING_AGING_QUERY'
WHERE `intent` = 'BOOKING_AGING';
--> statement-breakpoint
UPDATE `kai_response_templates`
SET `intent` = 'BOOKING_AGING_QUERY'
WHERE `intent` = 'BOOKING_AGING';
--> statement-breakpoint
UPDATE `kai_question_library`
SET `intent` = 'STOCK_AGING_MODEL_RANKING'
WHERE `intent` = 'STOCK_AGING_MODEL';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `intent` = 'STOCK_AGING_MODEL_RANKING'
WHERE `intent` = 'STOCK_AGING_MODEL';
--> statement-breakpoint
UPDATE `kai_response_templates`
SET `intent` = 'STOCK_AGING_MODEL_RANKING'
WHERE `intent` = 'STOCK_AGING_MODEL';
--> statement-breakpoint
DELETE FROM `kai_data_dictionary`
WHERE `business_name` = 'Stock Age Calculation'
	AND `table_name` = 'APPLICATION_MAPPING'
	AND `field_name` = 'app/api/data-hub/import/route.ts::calculateAgeDays';
