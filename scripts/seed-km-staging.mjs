import { spawnSync } from "node:child_process";
import process from "node:process";

const apply = process.argv.includes("--apply");
const database = "kmm-company-management-staging";
const config = "wrangler.staging.jsonc";
const actor = "multi-company-phase-2-staging-seed";

const sql = `
INSERT OR IGNORE INTO companies (
  id, tenant_id, company_id, company_name, company_code, legal_name,
  logo_url, tax_id, registration_number, business_type, industry,
  website, email, phone, address, description, status, published_at,
  created_by, updated_by
) VALUES (
  'kmm-company', 'kmm', 'kmm-company', 'KMM Company', 'KMM', '',
  '', '', '', '', '', '', '', '', '', '', 'active', CURRENT_TIMESTAMP,
  '${actor}', '${actor}'
);
INSERT OR IGNORE INTO fiscal_years (
  id, tenant_id, company_id, fiscal_year_name, start_month, start_day,
  end_month, end_day, current_fiscal_year, status, created_by, updated_by
) VALUES (
  'fiscal-default', 'kmm', 'kmm-company', 'FY2026', 1, 1,
  12, 31, 1, 'active', '${actor}', '${actor}'
);
INSERT OR IGNORE INTO company_currencies (
  id, tenant_id, company_id, primary_currency, display_currency,
  currency_symbol, decimal_places, number_format, negative_number_format,
  exchange_rate_source, manual_exchange_rate, status, created_by, updated_by
) VALUES (
  'currency-default', 'kmm', 'kmm-company', 'MMK', 'MMK',
  'K', 0, '1,234.56', '-1,234.56', 'manual', '1', 'active',
  '${actor}', '${actor}'
);
INSERT OR IGNORE INTO company_localizations (
  id, tenant_id, company_id, default_language, fallback_language,
  default_time_zone, date_format, time_format, first_day_of_week,
  status, created_by, updated_by
) VALUES (
  'stg-localization', 'kmm', 'kmm-company', 'en', 'th',
  'Asia/Yangon', 'DD/MM/YYYY', '24-hour', 'Monday', 'active',
  '${actor}', '${actor}'
);
INSERT OR IGNORE INTO working_calendars (
  id, tenant_id, company_id, working_days, weekend_days,
  working_start_time, working_end_time, status, created_by, updated_by
) VALUES (
  'calendar-default', 'kmm', 'kmm-company',
  '["Monday","Tuesday","Wednesday","Thursday","Friday"]',
  '["Saturday","Sunday"]', '08:00', '17:00', 'active',
  '${actor}', '${actor}'
);
INSERT OR IGNORE INTO branches (
  id, tenant_id, company_id, branch_name, branch_code, time_zone,
  status, created_by, updated_by
) VALUES
  ('kmm-branch-kmm01', 'kmm', 'kmm-company', 'Hpa-an', 'KMM01', 'Asia/Yangon', 'active', '${actor}', '${actor}'),
  ('kmm-branch-kmm02', 'kmm', 'kmm-company', 'Mawlamyine', 'KMM02', 'Asia/Yangon', 'active', '${actor}', '${actor}'),
  ('kmm-branch-kmm03', 'kmm', 'kmm-company', 'Tharyarwaddy', 'KMM03', 'Asia/Yangon', 'active', '${actor}', '${actor}');
INSERT OR IGNORE INTO companies (
  id, tenant_id, company_id, company_name, company_code, legal_name,
  logo_url, tax_id, registration_number, business_type, industry,
  website, email, phone, address, description, status, published_at,
  created_by, updated_by
) VALUES (
  'km-company', 'km', 'km-company', 'Kubota Maesod', 'KM', '',
  '', '', '', '', '', '', '', '', '', '', 'active', CURRENT_TIMESTAMP,
  '${actor}', '${actor}'
);
INSERT OR IGNORE INTO fiscal_years (
  id, tenant_id, company_id, fiscal_year_name, start_month, start_day,
  end_month, end_day, current_fiscal_year, status, created_by, updated_by
) VALUES (
  'km-company-fiscal-default', 'km', 'km-company', 'FY2026', 1, 1,
  12, 31, 1, 'active', '${actor}', '${actor}'
);
INSERT OR IGNORE INTO company_currencies (
  id, tenant_id, company_id, primary_currency, display_currency,
  currency_symbol, decimal_places, number_format, negative_number_format,
  exchange_rate_source, manual_exchange_rate, status, created_by, updated_by
) VALUES (
  'km-company-currency-default', 'km', 'km-company', 'THB', 'THB',
  '฿', 2, '1,234.56', '-1,234.56', 'manual', '1', 'active',
  '${actor}', '${actor}'
);
INSERT OR IGNORE INTO company_localizations (
  id, tenant_id, company_id, default_language, fallback_language,
  default_time_zone, date_format, time_format, first_day_of_week,
  status, created_by, updated_by
) VALUES (
  'km-company-localization-default', 'km', 'km-company', 'th', 'en',
  'Asia/Bangkok', 'DD/MM/YYYY', '24-hour', 'Monday', 'active',
  '${actor}', '${actor}'
);
INSERT OR IGNORE INTO working_calendars (
  id, tenant_id, company_id, working_days, weekend_days,
  working_start_time, working_end_time, status, created_by, updated_by
) VALUES (
  'km-company-calendar-default', 'km', 'km-company',
  '["Monday","Tuesday","Wednesday","Thursday","Friday"]',
  '["Saturday","Sunday"]', '08:00', '17:00', 'active',
  '${actor}', '${actor}'
);
INSERT OR IGNORE INTO company_users (
  id, tenant_id, company_id, user_id, email, role, status,
  created_by, updated_by
)
SELECT
  'km-company-' || user_id, 'km', 'km-company', user_id, email,
  'super_admin', 'active', '${actor}', '${actor}'
FROM company_users
WHERE company_id = 'kmm-company'
  AND role = 'super_admin'
  AND status = 'active';
`.trim();

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    database,
    config,
    companyIds: ["kmm-company", "km-company"],
    note: "No database changes were made. Re-run with --apply after staging migrations pass.",
  }, null, 2));
  process.exit(0);
}

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(executable, [
  "wrangler",
  "d1",
  "execute",
  database,
  "--remote",
  "--config",
  config,
  "--command",
  sql,
], { cwd: process.cwd(), env: process.env, stdio: "inherit", shell: false });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
