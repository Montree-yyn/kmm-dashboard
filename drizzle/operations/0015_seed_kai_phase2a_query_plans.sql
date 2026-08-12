-- KAI Phase 2A: executable, parameterized query plans stored in the Knowledge Layer.
-- The Runtime Query Engine interprets this small read-only DSL. User text never
-- becomes SQL and every source/field is checked against kai_data_dictionary.

UPDATE `kai_query_templates`
SET `required_data` = 'sales_transactions.company_id, sale_date, quantity, product_type, final_received',
	`query_logic` = '{"version":1,"source":"sales_transactions","response_kind":"sales_summary","period_mode":"current_month","date_field":"sale_date","filters":[{"field":"company_id","operator":"equals","parameter":"companyId"}],"aggregates":[{"alias":"sales_unit","function":"sum","field":"quantity","filters":[{"field":"product_type","operator":"in","values":["TT","01-TT","CH","02-CH","EX","04-EX","TP","03-TP"]}]},{"alias":"sales_value","function":"sum_real","field":"final_received"}]}'
WHERE `intent` = 'SALES_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `required_data` = 'sales_transactions.company_id, sale_date, quantity, product_type, final_received',
	`query_logic` = '{"version":1,"source":"sales_transactions","response_kind":"sales_year_compare","period_mode":"year_compare","date_field":"sale_date","filters":[{"field":"company_id","operator":"equals","parameter":"companyId"}],"aggregates":[{"alias":"sales_unit","function":"sum","field":"quantity","filters":[{"field":"product_type","operator":"in","values":["TT","01-TT","CH","02-CH","EX","04-EX","TP","03-TP"]}]},{"alias":"sales_value","function":"sum_real","field":"final_received"}]}'
WHERE `intent` = 'SALES_YOY_COMPARE';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `required_data` = 'booking_transactions.company_id, booking_date, booking_no, booking_price',
	`query_logic` = '{"version":1,"source":"booking_transactions","response_kind":"booking_summary","period_mode":"current_month","date_field":"booking_date","filters":[{"field":"company_id","operator":"equals","parameter":"companyId"}],"aggregates":[{"alias":"booking_unit","function":"count_star"},{"alias":"booking_value","function":"sum_real","field":"booking_price"}]}'
WHERE `intent` = 'BOOKING_CURRENT_MONTH';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `required_data` = 'booking_transactions.company_id, booking_date, status, product_model, branch',
	`query_logic` = '{"version":1,"source":"booking_transactions","response_kind":"booking_aging","period_mode":"reference_date","filters":[{"field":"company_id","operator":"equals","parameter":"companyId"},{"field":"booking_date","operator":"age_greater_than_days","parameter":"referenceDate","value":90},{"field":"status","operator":"not_in","values":["Delivered","Cancelled","Canceled","Closed"]}],"select":[{"field":"product_model","alias":"model"},{"field":"branch","alias":"branch"},{"field":"booking_date","alias":"booking_date"}],"limit":5000}'
WHERE `intent` = 'BOOKING_AGING';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `required_data` = 'stock_transactions.company_id, stock_status, kmm_flag, stock_age_days, product_model, branch, stock_number, serial_number, engine_number, chassis_number',
	`query_logic` = '{"version":1,"source":"stock_transactions","response_kind":"stock_aging_model","period_mode":"reference_date","filters":[{"field":"company_id","operator":"equals","parameter":"companyId"},{"field":"stock_status","operator":"equals_ci","value":"FREE STOCK"},{"field":"kmm_flag","operator":"equals","value":1},{"field":"stock_age_days","operator":"greater_than","value":90}],"select":[{"field":"product_model","alias":"model"},{"field":"branch","alias":"branch"},{"field":"stock_age_days","alias":"aging_days"},{"field":"stock_number","alias":"stock_number"},{"field":"serial_number","alias":"serial_number"},{"field":"engine_number","alias":"engine_number"},{"field":"chassis_number","alias":"chassis_number"}],"dedupe_by":["stock_number","serial_number","engine_number","chassis_number"],"limit":5000}'
WHERE `intent` = 'STOCK_AGING_MODEL';
