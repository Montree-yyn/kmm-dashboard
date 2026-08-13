-- KAI Phase 2B-04 follow-up: query verified Company Master records through
-- the separately bound COMPANY_DB. This migration stores no master copy in
-- OPERATIONS_DB; it only registers fixed read-only plans.

INSERT OR IGNORE INTO `kai_metrics`
  (`metric_code`, `metric_name`, `description`, `formula`, `data_source`, `unit_type`, `business_rule`, `ai_usage`)
VALUES
  ('MASTER003', 'Company Profile', 'ข้อมูลบริษัทที่ไม่อ่อนไหวจาก Company Master', 'Read active company profile', 'COMPANY_DB.companies', 'Text', 'คืนเฉพาะ name, code, business_type, industry, established_year, status หลัง view permission', 'ตอบข้อมูลบริษัท'),
  ('MASTER004', 'Company Currency', 'การตั้งค่าสกุลเงิน active ของบริษัท', 'Read active currency configuration', 'COMPANY_DB.company_currencies', 'Text', 'คืน display currency, symbol, decimal places และ number format เท่านั้น', 'ตอบสกุลเงินบริษัท'),
  ('MASTER005', 'Company Localization', 'ภาษาและเขตเวลาที่ active ของบริษัท', 'Read active localization configuration', 'COMPANY_DB.company_localizations', 'Text', 'คืน language/time zone/format เท่านั้น', 'ตอบ timezone และ locale บริษัท'),
  ('MASTER006', 'Fiscal Year', 'ปีบัญชี active ของบริษัท', 'List active fiscal years', 'COMPANY_DB.fiscal_years', 'Count', 'คืนชื่อและวันเริ่ม/สิ้นสุด; ไม่สร้าง period เอง', 'ตอบปีบัญชี'),
  ('MASTER007', 'Working Calendar', 'วันและเวลาทำการ active ของบริษัท', 'Read active working calendar', 'COMPANY_DB.working_calendars', 'Text', 'คืน working_days/weekend_days/start/end เท่านั้น', 'ตอบวันทำการ'),
  ('MASTER008', 'Department Directory', 'รายชื่อแผนก active ของบริษัท', 'List active departments', 'COMPANY_DB.departments', 'Count', 'คืน code, name, branch_id, users, status; ถ้าไม่มี row ให้ตอบไม่มีข้อมูล', 'ตอบรายชื่อแผนก'),
  ('MASTER009', 'Holiday Directory', 'วันหยุด active ของบริษัท', 'List active holidays', 'COMPANY_DB.holidays', 'Count', 'คืนชื่อ วันที่ ประเภท repeat และ branch scope; ถ้าไม่มี row ให้ตอบไม่มีข้อมูล', 'ตอบวันหยุด');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_data_dictionary`
  (`business_name`, `table_name`, `field_name`, `data_type`, `description`, `domain`)
VALUES
  ('Company Profile', 'companies', 'company_name', 'text', 'ชื่อบริษัทจาก COMPANY_DB', 'company'),
  ('Company Profile Code', 'companies', 'company_code', 'text', 'รหัสบริษัทจาก COMPANY_DB', 'company'),
  ('Company Currency', 'company_currencies', 'display_currency', 'text', 'สกุลเงินที่แสดงผลของบริษัท', 'company'),
  ('Company Currency Symbol', 'company_currencies', 'currency_symbol', 'text', 'สัญลักษณ์สกุลเงินบริษัท', 'company'),
  ('Company Time Zone', 'company_localizations', 'default_time_zone', 'text', 'เขตเวลา default ของบริษัท', 'company'),
  ('Fiscal Year Name', 'fiscal_years', 'fiscal_year_name', 'text', 'ชื่อปีบัญชี active', 'company'),
  ('Working Days', 'working_calendars', 'working_days', 'json text', 'วันทำการตาม Company Master', 'company'),
  ('Department Name', 'departments', 'department_name', 'text', 'ชื่อแผนก active', 'company'),
  ('Holiday Date', 'holidays', 'holiday_date', 'text', 'วันที่วันหยุด active', 'company');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_question_library`
  (`question`, `intent`, `domain`, `required_metric`, `response_type`)
VALUES
  ('Company profile', 'COMPANY_PROFILE_QUERY', 'company', 'MASTER003', 'summary'),
  ('Company currency', 'COMPANY_CURRENCY_QUERY', 'company', 'MASTER004', 'summary'),
  ('Company timezone', 'COMPANY_LOCALIZATION_QUERY', 'company', 'MASTER005', 'summary'),
  ('Fiscal year', 'FISCAL_YEAR_QUERY', 'company', 'MASTER006', 'list'),
  ('Working calendar', 'WORKING_CALENDAR_QUERY', 'company', 'MASTER007', 'summary'),
  ('Department directory', 'DEPARTMENT_DIRECTORY_QUERY', 'company', 'MASTER008', 'list'),
  ('Holiday directory', 'HOLIDAY_DIRECTORY_QUERY', 'company', 'MASTER009', 'list');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_query_templates`
  (`intent`, `purpose`, `required_data`, `query_logic`)
VALUES
  ('COMPANY_PROFILE_QUERY', 'ข้อมูล active Company Profile ที่ไม่อ่อนไหว', 'COMPANY_DB.companies.company_id, company_name, company_code, business_type, industry, established_year, status', '{"version":2,"source":"company_master","operation":"company_master","company_entity":"profile"}'),
  ('COMPANY_CURRENCY_QUERY', 'ข้อมูล active Company Currency', 'COMPANY_DB.company_currencies.company_id, primary_currency, display_currency, currency_symbol, decimal_places, number_format, status', '{"version":2,"source":"company_master","operation":"company_master","company_entity":"currency"}'),
  ('COMPANY_LOCALIZATION_QUERY', 'ข้อมูล active Company Localization', 'COMPANY_DB.company_localizations.company_id, default_language, fallback_language, default_time_zone, date_format, time_format, first_day_of_week, status', '{"version":2,"source":"company_master","operation":"company_master","company_entity":"localization"}'),
  ('FISCAL_YEAR_QUERY', 'รายชื่อ active Fiscal Year', 'COMPANY_DB.fiscal_years.company_id, fiscal_year_name, start_month, start_day, end_month, end_day, current_fiscal_year, status', '{"version":2,"source":"company_master","operation":"company_master","company_entity":"fiscal_year"}'),
  ('WORKING_CALENDAR_QUERY', 'ข้อมูล active Working Calendar', 'COMPANY_DB.working_calendars.company_id, working_days, weekend_days, working_start_time, working_end_time, status', '{"version":2,"source":"company_master","operation":"company_master","company_entity":"working_calendar"}'),
  ('DEPARTMENT_DIRECTORY_QUERY', 'รายชื่อ active Department', 'COMPANY_DB.departments.company_id, department_code, department_name, branch_id, users, status', '{"version":2,"source":"company_master","operation":"company_master","company_entity":"department"}'),
  ('HOLIDAY_DIRECTORY_QUERY', 'รายชื่อ active Holiday', 'COMPANY_DB.holidays.company_id, holiday_name, holiday_date, repeat_annually, holiday_type, branch_id, status', '{"version":2,"source":"company_master","operation":"company_master","company_entity":"holiday"}');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_response_templates` (`intent`, `response_structure`) VALUES
  ('COMPANY_PROFILE_QUERY', 'Company Name; Code; Business Type; Industry; Established Year; Status'),
  ('COMPANY_CURRENCY_QUERY', 'Display Currency; Symbol; Decimal Places; Number Format'),
  ('COMPANY_LOCALIZATION_QUERY', 'Time Zone; Default Language; Fallback Language; Date/Time Format'),
  ('FISCAL_YEAR_QUERY', 'Fiscal Year Name; Start Date; End Date; Current Flag'),
  ('WORKING_CALENDAR_QUERY', 'Working Days; Weekend Days; Start Time; End Time'),
  ('DEPARTMENT_DIRECTORY_QUERY', 'Department Code; Department Name; Branch Scope; User Count; Status'),
  ('HOLIDAY_DIRECTORY_QUERY', 'Holiday Name; Date; Type; Repeat; Branch Scope');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_alias_mapping`
  (`alias_word`, `canonical_term`, `intent`, `domain`)
VALUES
  ('ข้อมูลบริษัท', 'Company Profile', 'COMPANY_PROFILE_QUERY', 'company'),
  ('สกุลเงินบริษัท', 'Company Currency', 'COMPANY_CURRENCY_QUERY', 'company'),
  ('เขตเวลาบริษัท', 'Company Localization', 'COMPANY_LOCALIZATION_QUERY', 'company'),
  ('ปีบัญชี', 'Fiscal Year', 'FISCAL_YEAR_QUERY', 'company'),
  ('วันทำการ', 'Working Calendar', 'WORKING_CALENDAR_QUERY', 'company'),
  ('แผนก', 'Department Directory', 'DEPARTMENT_DIRECTORY_QUERY', 'company'),
  ('วันหยุด', 'Holiday Directory', 'HOLIDAY_DIRECTORY_QUERY', 'company');
