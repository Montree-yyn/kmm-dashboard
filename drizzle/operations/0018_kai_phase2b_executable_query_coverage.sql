-- KAI Phase 2B-02: convert every existing Knowledge Layer query template to
-- a verified, executable plan. The runtime owns parameter binding and only
-- accepts the operation names below; user text is never SQL.

UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_summary"}' WHERE `intent` = 'SALES_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_summary"}' WHERE `intent` = 'SALES_VALUE_CURRENT';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_compare"}' WHERE `intent` = 'SALES_MONTH_COMPARE';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_compare"}' WHERE `intent` = 'SALES_YOY_COMPARE';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_summary"}' WHERE `intent` = 'SALES_HISTORY_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_ranking","group_by":"branch"}' WHERE `intent` = 'SALES_BRANCH_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_ranking","group_by":"model"}' WHERE `intent` = 'SALES_MODEL_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_ranking","group_by":"product_type"}' WHERE `intent` = 'SALES_PRODUCT_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_gp"}' WHERE `intent` = 'SALES_GP_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"business_targets","operation":"sales_target","mode":"achievement"}' WHERE `intent` = 'SALES_ACHIEVEMENT_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"business_targets","operation":"sales_target","mode":"gap"}' WHERE `intent` = 'SALES_GAP_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"sales_transactions","operation":"sales_compare"}' WHERE `intent` = 'SALES_GROWTH_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_summary"}' WHERE `intent` = 'BOOKING_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_aging"}' WHERE `intent` = 'BOOKING_AGING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_summary"}' WHERE `intent` = 'BOOKING_VALUE_CURRENT';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_compare"}' WHERE `intent` = 'BOOKING_MONTH_COMPARE';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_compare"}' WHERE `intent` = 'BOOKING_YOY_COMPARE';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_summary"}' WHERE `intent` = 'BOOKING_HISTORY_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_aging","list":true}' WHERE `intent` = 'BOOKING_AGING_LIST';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_ranking","group_by":"product_model"}' WHERE `intent` = 'BOOKING_MODEL_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_ranking","group_by":"branch"}' WHERE `intent` = 'BOOKING_BRANCH_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"booking_transactions","operation":"booking_conversion"}' WHERE `intent` = 'BOOKING_CONVERSION_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_summary"}' WHERE `intent` = 'STOCK_CURRENT';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_summary"}' WHERE `intent` = 'STOCK_VALUE_CURRENT';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_aging","threshold":90}' WHERE `intent` = 'STOCK_AGING_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_aging","threshold":90}' WHERE `intent` = 'STOCK_AGING_MODEL';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_ranking","group_by":"product_model","threshold":90}' WHERE `intent` = 'STOCK_AGING_MODEL_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_ranking","group_by":"product_model"}' WHERE `intent` = 'STOCK_MODEL_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_ranking","group_by":"branch"}' WHERE `intent` = 'STOCK_BRANCH_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_aging","threshold":180}' WHERE `intent` = 'STOCK_SLOW_MOVING_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_ranking","group_by":"product_model","threshold":180}' WHERE `intent` = 'STOCK_SLOW_MOVING_MODEL_RANKING';
--> statement-breakpoint
UPDATE `kai_query_templates` SET `query_logic` = '{"version":2,"source":"stock_transactions","operation":"stock_summary"}' WHERE `intent` = 'STOCK_MODEL_QUERY';
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_question_library`
  (`question`, `intent`, `domain`, `required_metric`, `response_type`)
VALUES
  ('Target เดือนนี้เท่าไหร่', 'TARGET_CURRENT_QUERY', 'target', 'SALES004', 'summary'),
  ('เดือนนี้มีลูกค้าจองกี่ราย', 'CUSTOMER_BOOKING_QUERY', 'booking', 'BOOK001', 'summary'),
  ('Salesperson คนไหนขายได้มากที่สุด', 'SALES_PERSON_RANKING', 'sales', 'SALES001', 'ranking');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_query_templates`
  (`intent`, `purpose`, `required_data`, `query_logic`)
VALUES
  ('TARGET_CURRENT_QUERY', 'Target ที่อนุมัติในงวดที่ระบุ', 'business_targets.company_id, target_year, target_month, metric, target_value, approval_status', '{"version":2,"source":"business_targets","operation":"sales_target","mode":"target"}'),
  ('CUSTOMER_BOOKING_QUERY', 'จำนวนลูกค้า Booking ที่ไม่ซ้ำในงวดที่ระบุ', 'booking_transactions.company_id, booking_date, customer_name', '{"version":2,"source":"booking_transactions","operation":"customer_summary"}'),
  ('SALES_PERSON_RANKING', 'จัดอันดับ Salesperson ตาม Sales Unit', 'sales_transactions.company_id, sale_date, salesperson_name, quantity, product_type', '{"version":2,"source":"sales_transactions","operation":"sales_ranking","group_by":"salesperson_name"}');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_response_templates` (`intent`, `response_structure`) VALUES
  ('TARGET_CURRENT_QUERY', 'ช่วงข้อมูล; Approved Target; Metric; แหล่งข้อมูล'),
  ('CUSTOMER_BOOKING_QUERY', 'ช่วงข้อมูล; จำนวนลูกค้าที่ไม่ซ้ำ; แหล่งข้อมูล; ไม่แสดงข้อมูลระบุตัวบุคคล'),
  ('SALES_PERSON_RANKING', 'ช่วงข้อมูล; อันดับ Salesperson; Sales Unit; Sales Value');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_alias_mapping`
  (`alias_word`, `canonical_term`, `intent`, `domain`)
VALUES
  ('ยอดขายปีนี้', 'Sales Year To Date', 'SALES_HISTORY_QUERY', 'sales'),
  ('Sales Value', 'Sales Value', 'SALES_VALUE_CURRENT', 'sales'),
  ('กำไรขั้นต้น', 'GP Value', 'SALES_GP_QUERY', 'sales'),
  ('GP', 'GP Value', 'SALES_GP_QUERY', 'sales'),
  ('ยอดจอง', 'Booking', 'BOOKING_CURRENT_MONTH', 'booking'),
  ('Booking เดือนนี้', 'Booking', 'BOOKING_CURRENT_MONTH', 'booking'),
  ('Stock ปัจจุบัน', 'Current Stock', 'STOCK_CURRENT', 'stock'),
  ('สต็อก', 'Current Stock', 'STOCK_CURRENT', 'stock'),
  ('คงเหลือ', 'Current Stock', 'STOCK_CURRENT', 'stock'),
  ('Target', 'Approved Target', 'TARGET_CURRENT_QUERY', 'target'),
  ('เป้า', 'Approved Target', 'TARGET_CURRENT_QUERY', 'target'),
  ('ลูกค้า', 'Booking Customer Count', 'CUSTOMER_BOOKING_QUERY', 'booking'),
  ('Salesperson', 'Salesperson Ranking', 'SALES_PERSON_RANKING', 'sales'),
  ('พนักงานขาย', 'Salesperson Ranking', 'SALES_PERSON_RANKING', 'sales');
--> statement-breakpoint

-- “เกิน 90 วัน” alone is ambiguous across Booking and Stock and previously
-- routed Booking questions into Stock. Intent resolution now requires a domain.
DELETE FROM `kai_alias_mapping` WHERE `alias_word` = 'เกิน 90 วัน';
