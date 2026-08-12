INSERT OR IGNORE INTO `kai_response_templates` (`intent`, `response_structure`) VALUES
	('BOOKING_BRANCH_RANKING', 'สรุปอันดับ Booking ตามสาขา พร้อมจำนวน มูลค่า และสัดส่วน'),
	('BOOKING_HISTORY_QUERY', 'สรุปประวัติ Booking ตามช่วงเวลา พร้อมการเปรียบเทียบและแนวโน้ม'),
	('BOOKING_MODEL_RANKING', 'สรุปอันดับ Booking ตามรุ่น พร้อมจำนวนและมูลค่า'),
	('BOOKING_VALUE_CURRENT', 'สรุปมูลค่า Booking ปัจจุบัน พร้อมจำนวนรายการและช่วงเวลา'),
	('SALES_GAP_QUERY', 'สรุปช่องว่างยอดขายเทียบเป้าหมาย พร้อมจำนวนและสัดส่วนที่ขาดหรือเกิน'),
	('SALES_GROWTH_QUERY', 'สรุปการเติบโตของยอดขาย พร้อมค่าเปรียบเทียบและอัตราการเปลี่ยนแปลง'),
	('SALES_PRODUCT_RANKING', 'สรุปอันดับยอดขายตามรุ่นหรือสินค้า พร้อมจำนวน มูลค่า และ GP'),
	('SALES_VALUE_CURRENT', 'สรุปยอดขายปัจจุบัน พร้อมจำนวน มูลค่า และช่วงเวลา'),
	('STOCK_MODEL_QUERY', 'สรุป Stock ตามรุ่น พร้อมจำนวนและสถานะอายุ Stock');
--> statement-breakpoint
INSERT OR IGNORE INTO `kai_business_rules`
	(`rule_code`, `rule_name`, `condition`, `severity`, `action`, `domain`) VALUES
	('BOOKING_AGING_0_30', 'Booking Aging', 'age_days >= 0 AND age_days <= 30', 'Normal', 'จัดการตามขั้นตอนปกติ', 'booking'),
	('BOOKING_AGING_31_60', 'Booking Aging', 'age_days >= 31 AND age_days <= 60', 'Monitor', 'ติดตามสถานะ Booking', 'booking'),
	('BOOKING_AGING_61_90', 'Booking Aging', 'age_days >= 61 AND age_days <= 90', 'Risk', 'เร่งติดตามและประเมินความเสี่ยง', 'booking'),
	('BOOKING_AGING_GT_90', 'Booking Aging', 'age_days > 90', 'Critical', 'เร่งแก้ไขและรายงานผู้รับผิดชอบ', 'booking'),
	('STOCK_AGING_0_90', 'Stock Aging', 'age_days >= 0 AND age_days <= 90', 'Healthy', 'บริหารตามแผนปกติ', 'stock'),
	('STOCK_AGING_91_180', 'Stock Aging', 'age_days >= 91 AND age_days <= 180', 'Monitor', 'ติดตามและวางแผนระบาย Stock', 'stock'),
	('STOCK_AGING_181_365', 'Stock Aging', 'age_days >= 181 AND age_days <= 365', 'Slow Moving', 'จัดทำแผนเร่งระบาย Stock', 'stock'),
	('STOCK_AGING_GT_365', 'Stock Aging', 'age_days > 365', 'Critical', 'เร่งระบายและยกระดับการจัดการ', 'stock'),
	('PRODUCT_UNIT_CODES', 'Product Unit Rule', 'product_type IN (TT, CH, EX, TP)', 'RULE', 'นับเป็น Unit', 'product'),
	('PRODUCT_VALUE_ONLY_CODES', 'Product Value Only Rule', 'product_type IN (IM, IMO, OT)', 'RULE', 'นับเป็น Value Only', 'product');
--> statement-breakpoint
INSERT OR IGNORE INTO `kai_alias_mapping`
	(`alias_word`, `canonical_term`, `intent`, `domain`) VALUES
	('ขาย', 'Sales', 'SALES_CURRENT', 'sales'),
	('ยอดขาย', 'Sales', 'SALES_CURRENT', 'sales'),
	('จอง', 'Booking', 'BOOKING_CURRENT', 'booking'),
	('ใบจอง', 'Booking', 'BOOKING_CURRENT', 'booking'),
	('รถค้าง', 'Stock Aging', 'STOCK_AGING_QUERY', 'stock'),
	('เกิน 90 วัน', 'Aging', 'STOCK_AGING_QUERY', 'stock'),
	('รุ่น', 'Model', 'MODEL_FILTER', 'shared');
