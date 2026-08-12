-- Manual rollback for the Phase 1E audit fix.
-- Run only before these seed records are used or edited by a later phase.

UPDATE `kai_metrics`
SET `business_rule` = '>90 วัน = Aging Risk ตาม Phase 1E rule'
WHERE `metric_code` = 'BOOK003';
--> statement-breakpoint
UPDATE `kai_metrics`
SET `business_rule` = '>90 วัน = Aging Stock ตาม Phase 1E rule'
WHERE `metric_code` = 'STOCK003';
--> statement-breakpoint
UPDATE `kai_metrics`
SET `business_rule` = '>180 วัน = Slow Moving; ต้องใช้ current-stock scope ก่อนจัดกลุ่ม'
WHERE `metric_code` = 'STOCK004';
--> statement-breakpoint
DELETE FROM `kai_response_templates`
WHERE `intent` IN (
	'BOOKING_BRANCH_RANKING',
	'BOOKING_HISTORY_QUERY',
	'BOOKING_MODEL_RANKING',
	'BOOKING_VALUE_CURRENT',
	'SALES_GAP_QUERY',
	'SALES_GROWTH_QUERY',
	'SALES_PRODUCT_RANKING',
	'SALES_VALUE_CURRENT',
	'STOCK_MODEL_QUERY'
);
--> statement-breakpoint
DROP INDEX IF EXISTS `kai_alias_mapping_domain_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `kai_alias_mapping_unique_term`;
--> statement-breakpoint
DROP TABLE IF EXISTS `kai_alias_mapping`;
--> statement-breakpoint
DROP TABLE IF EXISTS `kai_business_rules`;
