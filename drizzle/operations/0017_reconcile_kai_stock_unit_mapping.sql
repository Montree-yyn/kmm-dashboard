-- KAI Phase 2A: reconcile Stock Aging with Dashboard's verified application
-- mapping for source product_type 08-TX rows that classify as TT by model.

UPDATE `kai_query_templates`
SET `required_data` = 'stock_transactions.company_id, as_of_date, stock_status, kmm_flag, product_type, product_model, stock_age_days, branch, physical identifiers + Dashboard stock unit application mapping',
    `query_logic` = '{"version":1,"source":"stock_transactions","response_kind":"stock_aging_model","period_mode":"reference_date","snapshot_mode":"latest","snapshot_field":"as_of_date","filters":[{"field":"company_id","operator":"equals","parameter":"companyId"},{"field":"stock_status","operator":"equals_ci","value":"Free Stock"},{"field":"kmm_flag","operator":"equals","value":1},{"field":"product_type","operator":"in","values":["01-TT","TT","02-CH","CH","03-EX","EX","04-TP","TP","08-TX"]},{"field":"stock_age_days","operator":"greater_than","value":90}],"select":[{"field":"product_model","alias":"model"},{"field":"branch","alias":"branch"},{"field":"stock_age_days","alias":"aging_days"},{"field":"as_of_date","alias":"snapshot_date"},{"field":"stock_number","alias":"stock_number"},{"field":"serial_number","alias":"serial_number"},{"field":"engine_number","alias":"engine_number"},{"field":"chassis_number","alias":"chassis_number"}],"dedupe_by":["stock_number","serial_number","engine_number","chassis_number"],"limit":5000}'
WHERE `intent` = 'STOCK_AGING_MODEL';
--> statement-breakpoint
INSERT OR IGNORE INTO `kai_data_dictionary`
	(`business_name`, `table_name`, `field_name`, `data_type`, `description`, `domain`)
VALUES
	('Stock Unit Dashboard Application Mapping', 'APPLICATION_MAPPING', 'lib/dashboard/stock-selectors.ts::classifyStockModelFallback', 'CODE_RULE', 'Dashboard classifies verified source product_type 08-TX rows with NSPU/MU model patterns as TT for Unit and Aging scopes; this mapping is source-backed and must not be generalized to other codes.', 'stock');
