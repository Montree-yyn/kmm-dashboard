-- KAI Phase 2B-04: verified business coverage only.
-- All plans remain declarative records; runtime-query-v2 owns the fixed SQL
-- grammar and binds every user-derived value.  No Company master data is
-- copied into OPERATIONS_DB.

INSERT OR IGNORE INTO `kai_metrics`
  (`metric_code`, `metric_name`, `description`, `formula`, `data_source`, `unit_type`, `business_rule`, `ai_usage`)
VALUES
  ('SALES007', 'Sales Expense', 'ค่า Expense จาก Sales source ที่อยู่ใน scope legacy value products ที่ยืนยันแล้ว', 'SUM(expense) เมื่อทุก row ใน scope มีค่า expense', 'OPERATIONS_DB.sales_transactions.expense', 'Value', 'ใช้เฉพาะ 01-TT, 02-CH, 03-TP, 04-EX, 06-IM, 07-IMO, 08-OT; ถ้าข้อมูล expense ไม่ครบ ต้องตอบว่าไม่พร้อม', 'ตอบค่าใช้จ่ายจาก Sales ที่ตรวจสอบได้'),
  ('BOOK005', 'Recorded Booking Deposit', 'ยอดเงินมัดจำที่บันทึกใน Booking source', 'SUM(deposit_amount ที่มีค่า)', 'OPERATIONS_DB.booking_transactions.deposit_amount', 'Value', 'ค่าที่ว่างไม่ถูกตีความเป็นศูนย์ และต้องเปิดเผยจำนวน Booking ที่ไม่มีค่า Deposit', 'ตอบยอดมัดจำที่บันทึกไว้เท่านั้น'),
  ('TGT001', 'Sales Revenue Target', 'Target รายเดือนที่อนุมัติของ Sales Revenue', 'SUM(approved SALES_REVENUE target_value) ตามเดือนเต็ม', 'OPERATIONS_DB.business_targets.target_value', 'Value', 'ใช้เฉพาะ approval_status=approved, company-wide, branch_id และ salesperson_id ว่าง', 'ตอบ Target/Actual/Achievement/Gap ของ Sales Revenue'),
  ('TGT002', 'GP Target', 'Target รายเดือนที่อนุมัติของ GP1', 'SUM(approved GP1 target_value) ตามเดือนเต็ม', 'OPERATIONS_DB.business_targets.target_value', 'Value', 'ใช้เฉพาะ approval_status=approved, company-wide, branch_id และ salesperson_id ว่าง; GP actual ต้องครบ', 'ตอบ Target/Actual/Achievement/Gap ของ GP'),
  ('MASTER001', 'Active Branch Master', 'รายชื่อสาขา active จาก Company Master', 'COUNT/LIST active branches', 'COMPANY_DB.branches', 'Count', 'อ่านผ่าน COMPANY_DB หลังตรวจ company membership และ view permission; ไม่มีการ copy เข้า OPERATIONS_DB', 'ตอบรายชื่อและ location ที่มีการลงทะเบียน'),
  ('MASTER002', 'Salesperson Master', 'รายชื่อและสถานะพนักงานขายจาก Operations master', 'COUNT/LIST salesperson_master', 'OPERATIONS_DB.salesperson_master', 'Count', 'คืนเฉพาะ salesperson_code, salesperson_name, status ใน company scope', 'ตอบ directory พนักงานขาย');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_data_dictionary`
  (`business_name`, `table_name`, `field_name`, `data_type`, `description`, `domain`)
VALUES
  ('Sales Expense Source', 'sales_transactions', 'expense', 'text numeric', 'ค่า Expense จาก source; ใช้ได้เฉพาะเมื่อทุก row ของ scope มีค่า', 'sales'),
  ('Booking Recorded Deposit Completeness', 'booking_transactions', 'deposit_amount', 'text numeric', 'เงินมัดจำที่บันทึกไว้; blank ไม่เท่ากับศูนย์', 'booking'),
  ('Salesperson Master Code', 'salesperson_master', 'salesperson_code', 'text', 'รหัสพนักงานขายที่ยืนยันใน Operations master', 'salesperson'),
  ('Salesperson Master Name', 'salesperson_master', 'salesperson_name', 'text', 'ชื่อพนักงานขายที่ยืนยันใน Operations master', 'salesperson'),
  ('Salesperson Master Status', 'salesperson_master', 'status', 'text', 'สถานะพนักงานขายจาก Operations master', 'salesperson'),
  ('Approved Target Version', 'business_targets', 'source_version', 'text', 'เวอร์ชัน target ที่ runtime เลือกล่าสุดตาม effective_from, updated_at และ source_version', 'target'),
  ('Approved Target Scope', 'business_targets', 'branch_id', 'text', 'scope Branch ของ target; Local verified data มีเฉพาะค่าว่าง = company-wide', 'target'),
  ('Approved Target Salesperson Scope', 'business_targets', 'salesperson_id', 'text', 'scope Salesperson ของ target; Local verified data มีเฉพาะค่าว่าง = company-wide', 'target');
--> statement-breakpoint

-- Existing Sales Unit target intents receive an explicit metric so every
-- template records its exact target source rather than relying on a default.
UPDATE `kai_query_templates`
SET `query_logic` = '{"version":2,"source":"business_targets","operation":"sales_target","mode":"target","target_metric":"SALES_UNITS"}'
WHERE `intent` = 'TARGET_CURRENT_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `query_logic` = '{"version":2,"source":"business_targets","operation":"sales_target","mode":"achievement","target_metric":"SALES_UNITS"}'
WHERE `intent` = 'SALES_ACHIEVEMENT_QUERY';
--> statement-breakpoint
UPDATE `kai_query_templates`
SET `query_logic` = '{"version":2,"source":"business_targets","operation":"sales_target","mode":"gap","target_metric":"SALES_UNITS"}'
WHERE `intent` = 'SALES_GAP_QUERY';
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_question_library`
  (`question`, `intent`, `domain`, `required_metric`, `response_type`)
VALUES
  ('Sales Expense เดือนนี้เท่าไหร่', 'SALES_EXPENSE_QUERY', 'sales', 'SALES007', 'summary'),
  ('ยอดมัดจำ Booking เดือนนี้เท่าไหร่', 'BOOKING_DEPOSIT_QUERY', 'booking', 'BOOK005', 'summary'),
  ('Booking Salesperson ranking เดือนนี้', 'BOOKING_SALESPERSON_RANKING', 'booking', 'BOOK001,BOOK002', 'ranking'),
  ('Booking Purchase Status breakdown เดือนนี้', 'BOOKING_PURCHASE_STATUS_RANKING', 'booking', 'BOOK001,BOOK002', 'ranking'),
  ('Booking Status breakdown เดือนนี้', 'BOOKING_STATUS_RANKING', 'booking', 'BOOK001,BOOK002', 'ranking'),
  ('Sales Revenue Target เดือนนี้เท่าไหร่', 'SALES_REVENUE_TARGET_QUERY', 'target', 'TGT001,SALES002', 'summary'),
  ('Sales Revenue Achievement เดือนนี้', 'SALES_REVENUE_ACHIEVEMENT_QUERY', 'target', 'TGT001,SALES002', 'summary'),
  ('Sales Revenue Gap เดือนนี้', 'SALES_REVENUE_GAP_QUERY', 'target', 'TGT001,SALES002', 'summary'),
  ('GP Target เดือนนี้เท่าไหร่', 'SALES_GP_TARGET_QUERY', 'target', 'TGT002,SALES003', 'summary'),
  ('GP Achievement เดือนนี้', 'SALES_GP_ACHIEVEMENT_QUERY', 'target', 'TGT002,SALES003', 'summary'),
  ('GP Gap เดือนนี้', 'SALES_GP_GAP_QUERY', 'target', 'TGT002,SALES003', 'summary'),
  ('รายชื่อ Salesperson', 'SALESPERSON_MASTER_QUERY', 'salesperson', 'MASTER002', 'list'),
  ('รายชื่อสาขา', 'BRANCH_DIRECTORY_QUERY', 'branch', 'MASTER001', 'list');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_query_templates`
  (`intent`, `purpose`, `required_data`, `query_logic`)
VALUES
  ('SALES_EXPENSE_QUERY', 'สรุป Sales Expense ที่ครบถ้วนใน verified legacy value-product scope', 'sales_transactions.company_id, sale_date, product_type, expense', '{"version":2,"source":"sales_transactions","operation":"sales_expense"}'),
  ('BOOKING_DEPOSIT_QUERY', 'สรุปยอด Deposit ที่บันทึกไว้และเปิดเผยความครบถ้วนของ source', 'booking_transactions.company_id, booking_date, deposit_amount', '{"version":2,"source":"booking_transactions","operation":"booking_deposit"}'),
  ('BOOKING_SALESPERSON_RANKING', 'จัดอันดับ Booking ตาม salesperson_name', 'booking_transactions.company_id, booking_date, salesperson_name, booking_price', '{"version":2,"source":"booking_transactions","operation":"booking_ranking","group_by":"salesperson_name"}'),
  ('BOOKING_PURCHASE_STATUS_RANKING', 'สรุป Booking ตาม purchase_status', 'booking_transactions.company_id, booking_date, purchase_status, booking_price', '{"version":2,"source":"booking_transactions","operation":"booking_ranking","group_by":"purchase_status"}'),
  ('BOOKING_STATUS_RANKING', 'สรุป Booking ตาม canonical lifecycle status', 'booking_transactions.company_id, booking_date, status, booking_price', '{"version":2,"source":"booking_transactions","operation":"booking_ranking","group_by":"status"}'),
  ('SALES_REVENUE_TARGET_QUERY', 'Target Sales Revenue ที่อนุมัติในงวดเต็ม', 'business_targets.company_id, target_year, target_month, metric, target_value, approval_status; sales_transactions.final_received', '{"version":2,"source":"business_targets","operation":"sales_target","mode":"target","target_metric":"SALES_REVENUE"}'),
  ('SALES_REVENUE_ACHIEVEMENT_QUERY', 'Actual เทียบ Target Sales Revenue ที่อนุมัติ', 'business_targets.target_value; sales_transactions.final_received', '{"version":2,"source":"business_targets","operation":"sales_target","mode":"achievement","target_metric":"SALES_REVENUE"}'),
  ('SALES_REVENUE_GAP_QUERY', 'Gap ระหว่าง Target และ Actual Sales Revenue', 'business_targets.target_value; sales_transactions.final_received', '{"version":2,"source":"business_targets","operation":"sales_target","mode":"gap","target_metric":"SALES_REVENUE"}'),
  ('SALES_GP_TARGET_QUERY', 'Target GP1 ที่อนุมัติในงวดเต็ม', 'business_targets.company_id, target_year, target_month, metric, target_value, approval_status; sales_transactions.gp1', '{"version":2,"source":"business_targets","operation":"sales_target","mode":"target","target_metric":"GP1"}'),
  ('SALES_GP_ACHIEVEMENT_QUERY', 'Actual GP1 เทียบ Target ที่อนุมัติ', 'business_targets.target_value; sales_transactions.gp1', '{"version":2,"source":"business_targets","operation":"sales_target","mode":"achievement","target_metric":"GP1"}'),
  ('SALES_GP_GAP_QUERY', 'Gap ระหว่าง Target GP1 และ Actual GP1', 'business_targets.target_value; sales_transactions.gp1', '{"version":2,"source":"business_targets","operation":"sales_target","mode":"gap","target_metric":"GP1"}'),
  ('SALESPERSON_MASTER_QUERY', 'รายชื่อ salesperson ที่มีอยู่จริงใน Operations master', 'salesperson_master.company_id, salesperson_code, salesperson_name, status', '{"version":2,"source":"salesperson_master","operation":"salesperson_master"}'),
  ('BRANCH_DIRECTORY_QUERY', 'รายชื่อ active branch จาก COMPANY_DB หลัง authorization', 'COMPANY_DB.branches.company_id, branch_code, branch_name, region, township, status', '{"version":2,"source":"company_branches","operation":"branch_directory"}');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_response_templates` (`intent`, `response_structure`) VALUES
  ('SALES_EXPENSE_QUERY', 'ช่วงข้อมูล; Sales Expense; สถานะความครบถ้วนของ Expense'),
  ('BOOKING_DEPOSIT_QUERY', 'ช่วงข้อมูล; Recorded Deposit; จำนวน Booking ที่ไม่มีค่า Deposit'),
  ('BOOKING_SALESPERSON_RANKING', 'ช่วงข้อมูล; อันดับ Salesperson; Booking Unit; Booking Value'),
  ('BOOKING_PURCHASE_STATUS_RANKING', 'ช่วงข้อมูล; Purchase Status; Booking Unit; Booking Value'),
  ('BOOKING_STATUS_RANKING', 'ช่วงข้อมูล; Lifecycle Status; Booking Unit; Booking Value'),
  ('SALES_REVENUE_TARGET_QUERY', 'ช่วงข้อมูลเต็ม; Approved Sales Revenue Target; Actual; Achievement; Gap; Source Version'),
  ('SALES_REVENUE_ACHIEVEMENT_QUERY', 'ช่วงข้อมูลเต็ม; Approved Sales Revenue Target; Actual; Achievement; Gap; Source Version'),
  ('SALES_REVENUE_GAP_QUERY', 'ช่วงข้อมูลเต็ม; Approved Sales Revenue Target; Actual; Achievement; Gap; Source Version'),
  ('SALES_GP_TARGET_QUERY', 'ช่วงข้อมูลเต็ม; Approved GP Target; Actual GP; Achievement; Gap; Source Version'),
  ('SALES_GP_ACHIEVEMENT_QUERY', 'ช่วงข้อมูลเต็ม; Approved GP Target; Actual GP; Achievement; Gap; Source Version'),
  ('SALES_GP_GAP_QUERY', 'ช่วงข้อมูลเต็ม; Approved GP Target; Actual GP; Achievement; Gap; Source Version'),
  ('SALESPERSON_MASTER_QUERY', 'จำนวน Salesperson; salesperson_code; salesperson_name; status'),
  ('BRANCH_DIRECTORY_QUERY', 'จำนวน Active Branch; branch_code; branch_name; region/township ที่มีการลงทะเบียน');
--> statement-breakpoint

INSERT OR IGNORE INTO `kai_alias_mapping`
  (`alias_word`, `canonical_term`, `intent`, `domain`)
VALUES
  ('Sales Expense', 'Sales Expense', 'SALES_EXPENSE_QUERY', 'sales'),
  ('ค่าใช้จ่ายขาย', 'Sales Expense', 'SALES_EXPENSE_QUERY', 'sales'),
  ('มัดจำ', 'Recorded Booking Deposit', 'BOOKING_DEPOSIT_QUERY', 'booking'),
  ('Purchase Status', 'Booking Purchase Status', 'BOOKING_PURCHASE_STATUS_RANKING', 'booking'),
  ('Booking Status', 'Booking Lifecycle Status', 'BOOKING_STATUS_RANKING', 'booking'),
  ('Sales Revenue Target', 'Approved Sales Revenue Target', 'SALES_REVENUE_TARGET_QUERY', 'target'),
  ('GP Target', 'Approved GP Target', 'SALES_GP_TARGET_QUERY', 'target'),
  ('รายชื่อ Salesperson', 'Salesperson Master', 'SALESPERSON_MASTER_QUERY', 'salesperson'),
  ('รายชื่อสาขา', 'Active Branch Master', 'BRANCH_DIRECTORY_QUERY', 'branch');
