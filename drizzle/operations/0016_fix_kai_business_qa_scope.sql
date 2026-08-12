-- KAI Phase 2A Business QA fixes.
-- Keep Runtime Query read-only and align Stock Aging with the Dashboard's
-- current Free Stock Unit population and latest approved snapshot.

UPDATE `kai_query_templates`
SET `required_data` = 'stock_transactions.company_id, as_of_date, stock_status, kmm_flag, product_type, product_model, stock_age_days, branch, physical identifiers',
    `query_logic` = '{"version":1,"source":"stock_transactions","response_kind":"stock_aging_model","period_mode":"reference_date","snapshot_mode":"latest","snapshot_field":"as_of_date","filters":[{"field":"company_id","operator":"equals","parameter":"companyId"},{"field":"stock_status","operator":"equals_ci","value":"Free Stock"},{"field":"kmm_flag","operator":"equals","value":1},{"field":"product_type","operator":"in","values":["01-TT","TT","02-CH","CH","03-EX","EX","04-TP","TP"]},{"field":"stock_age_days","operator":"greater_than","value":90}],"select":[{"field":"product_model","alias":"model"},{"field":"branch","alias":"branch"},{"field":"stock_age_days","alias":"aging_days"},{"field":"as_of_date","alias":"snapshot_date"},{"field":"stock_number","alias":"stock_number"},{"field":"serial_number","alias":"serial_number"},{"field":"engine_number","alias":"engine_number"},{"field":"chassis_number","alias":"chassis_number"}],"dedupe_by":["stock_number","serial_number","engine_number","chassis_number"],"limit":5000}'
WHERE `intent` = 'STOCK_AGING_MODEL';
--> statement-breakpoint
