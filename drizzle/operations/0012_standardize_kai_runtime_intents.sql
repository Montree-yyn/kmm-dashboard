-- KAI Phase 1E runtime-test fix: standardize the requested canonical intents.
-- This migration renames existing knowledge rows without changing operational data.

UPDATE `kai_question_library`
SET `intent` = 'SALES_CURRENT_MONTH'
WHERE `intent` = 'SALES_CURRENT';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `intent` = 'SALES_CURRENT_MONTH'
WHERE `intent` = 'SALES_CURRENT';
--> statement-breakpoint
UPDATE `kai_response_templates`
SET `intent` = 'SALES_CURRENT_MONTH'
WHERE `intent` = 'SALES_CURRENT';
--> statement-breakpoint
UPDATE `kai_alias_mapping`
SET `intent` = 'SALES_CURRENT_MONTH'
WHERE `intent` = 'SALES_CURRENT';
--> statement-breakpoint
UPDATE `kai_question_library`
SET `intent` = 'BOOKING_CURRENT_MONTH'
WHERE `intent` = 'BOOKING_CURRENT';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `intent` = 'BOOKING_CURRENT_MONTH'
WHERE `intent` = 'BOOKING_CURRENT';
--> statement-breakpoint
UPDATE `kai_response_templates`
SET `intent` = 'BOOKING_CURRENT_MONTH'
WHERE `intent` = 'BOOKING_CURRENT';
--> statement-breakpoint
UPDATE `kai_alias_mapping`
SET `intent` = 'BOOKING_CURRENT_MONTH'
WHERE `intent` = 'BOOKING_CURRENT';
--> statement-breakpoint
UPDATE `kai_question_library`
SET `intent` = 'BOOKING_AGING'
WHERE `intent` = 'BOOKING_AGING_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `intent` = 'BOOKING_AGING'
WHERE `intent` = 'BOOKING_AGING_QUERY';
--> statement-breakpoint
UPDATE `kai_response_templates`
SET `intent` = 'BOOKING_AGING'
WHERE `intent` = 'BOOKING_AGING_QUERY';
--> statement-breakpoint
UPDATE `kai_question_library`
SET `intent` = 'STOCK_AGING_MODEL'
WHERE `intent` = 'STOCK_AGING_MODEL_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `intent` = 'STOCK_AGING_MODEL'
WHERE `intent` = 'STOCK_AGING_MODEL_RANKING';
--> statement-breakpoint
UPDATE `kai_response_templates`
SET `intent` = 'STOCK_AGING_MODEL'
WHERE `intent` = 'STOCK_AGING_MODEL_RANKING';
--> statement-breakpoint
UPDATE `kai_alias_mapping`
SET `canonical_term` = 'Stock Aging',
	`intent` = 'STOCK_AGING_MODEL'
WHERE `intent` = 'STOCK_AGING_QUERY'
	AND `domain` = 'stock';
