-- Commission Phase C2.3: Local-only canonical identities for CPI v3 employees
-- marked "(Out)".  These records preserve historical ownership; they must not
-- be deployed or used to substitute a current salesperson.
INSERT INTO `salesperson_master` (
  `id`, `tenant_id`, `company_id`, `employee_code`, `salesperson_code`,
  `salesperson_name`, `status`, `created_by`, `updated_by`
) VALUES
  ('local-c23-historical-mm150701', 'kmm-tenant', 'kmm-company', 'MM150701', 'MM150701', 'TEE', 'inactive', 'local-commission-c2.3', 'local-commission-c2.3'),
  ('local-c23-historical-mm150807', 'kmm-tenant', 'kmm-company', 'MM150807', 'MM150807', 'Nay Blute', 'inactive', 'local-commission-c2.3', 'local-commission-c2.3'),
  ('local-c23-historical-mm170309', 'kmm-tenant', 'kmm-company', 'MM170309', 'MM170309', 'Chan', 'inactive', 'local-commission-c2.3', 'local-commission-c2.3'),
  ('local-c23-historical-mm190905', 'kmm-tenant', 'kmm-company', 'MM190905', 'MM190905', 'ZMK', 'inactive', 'local-commission-c2.3', 'local-commission-c2.3'),
  ('local-c23-historical-mm220404', 'kmm-tenant', 'kmm-company', 'MM220404', 'MM220404', 'Zwe Mon', 'inactive', 'local-commission-c2.3', 'local-commission-c2.3'),
  ('local-c23-historical-mm220407', 'kmm-tenant', 'kmm-company', 'MM220407', 'MM220407', 'Kaung Si Thu', 'inactive', 'local-commission-c2.3', 'local-commission-c2.3'),
  ('local-c23-historical-mm230802', 'kmm-tenant', 'kmm-company', 'MM230802', 'MM230802', 'San Ko Ko', 'inactive', 'local-commission-c2.3', 'local-commission-c2.3'),
  ('local-c23-historical-mm250602', 'kmm-tenant', 'kmm-company', 'MM250602', 'MM250602', 'Nyi Zaw', 'inactive', 'local-commission-c2.3', 'local-commission-c2.3');
