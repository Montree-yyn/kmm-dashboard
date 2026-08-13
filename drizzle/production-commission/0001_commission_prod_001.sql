-- Production Commission rollout only. This independent lineage deliberately
-- does not mark or execute OPERATIONS_DB migrations 0007-0023.
ALTER TABLE `sales_transactions` ADD COLUMN `commission` text;

CREATE TABLE `salesperson_identity_aliases` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `company_id` text NOT NULL,
  `source_salesperson_code` text,
  `source_employee_code` text,
  `source_salesperson_name` text NOT NULL,
  `source_branch` text NOT NULL,
  `canonical_employee_code` text NOT NULL,
  `canonical_salesperson_code` text NOT NULL,
  `evidence` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL
);
CREATE INDEX `salesperson_identity_alias_company_scope_idx`
  ON `salesperson_identity_aliases` (`company_id`, `source_branch`, `source_salesperson_name`);

-- Exact approved C2.1 alias. Source name/branch must match; it never uses a
-- display-name-only match.
INSERT INTO `salesperson_identity_aliases` (
  `id`, `tenant_id`, `company_id`, `source_salesperson_code`, `source_employee_code`,
  `source_salesperson_name`, `source_branch`, `canonical_employee_code`,
  `canonical_salesperson_code`, `evidence`, `created_by`
) VALUES (
  'commission-prod-001-ye-htet-kmm01', 'kmm-tenant', 'kmm-company', NULL, NULL,
  '01-Ye Htet', 'KMM01', 'MM240503', 'MM240503',
  'CPI v3: exact KMM01 source name has two missing-code rows (Commission 400000); coded KMM01 history uses MM240503.',
  'commission-prod-001'
);

-- Exact approved C2.3 historical identities. Status is inactive so these
-- records cannot become current-salesperson performance by default.
INSERT INTO `salesperson_master` (
  `id`, `tenant_id`, `company_id`, `employee_code`, `salesperson_code`,
  `salesperson_name`, `status`, `created_by`, `updated_by`
) VALUES
  ('commission-prod-001-historical-mm150701', 'kmm-tenant', 'kmm-company', 'MM150701', 'MM150701', 'TEE', 'inactive', 'commission-prod-001', 'commission-prod-001'),
  ('commission-prod-001-historical-mm150807', 'kmm-tenant', 'kmm-company', 'MM150807', 'MM150807', 'Nay Blute', 'inactive', 'commission-prod-001', 'commission-prod-001'),
  ('commission-prod-001-historical-mm170309', 'kmm-tenant', 'kmm-company', 'MM170309', 'MM170309', 'Chan', 'inactive', 'commission-prod-001', 'commission-prod-001'),
  ('commission-prod-001-historical-mm190905', 'kmm-tenant', 'kmm-company', 'MM190905', 'MM190905', 'ZMK', 'inactive', 'commission-prod-001', 'commission-prod-001'),
  ('commission-prod-001-historical-mm220404', 'kmm-tenant', 'kmm-company', 'MM220404', 'MM220404', 'Zwe Mon', 'inactive', 'commission-prod-001', 'commission-prod-001'),
  ('commission-prod-001-historical-mm220407', 'kmm-tenant', 'kmm-company', 'MM220407', 'MM220407', 'Kaung Si Thu', 'inactive', 'commission-prod-001', 'commission-prod-001'),
  ('commission-prod-001-historical-mm230802', 'kmm-tenant', 'kmm-company', 'MM230802', 'MM230802', 'San Ko Ko', 'inactive', 'commission-prod-001', 'commission-prod-001'),
  ('commission-prod-001-historical-mm250602', 'kmm-tenant', 'kmm-company', 'MM250602', 'MM250602', 'Nyi Zaw', 'inactive', 'commission-prod-001', 'commission-prod-001');
