-- Commission Phase C2.1: controlled, company-scoped legacy identity aliases.
-- This migration is applied to Local Operations D1 only in this phase.
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
CREATE INDEX `salesperson_identity_alias_company_scope_idx` ON `salesperson_identity_aliases` (`company_id`,`source_branch`,`source_salesperson_name`);
