-- Commission Phase C1: additive nullable CPI "Total" field.
-- Local migration only for this phase; no existing Sales data is rewritten.
ALTER TABLE `sales_transactions` ADD COLUMN `commission` text;
