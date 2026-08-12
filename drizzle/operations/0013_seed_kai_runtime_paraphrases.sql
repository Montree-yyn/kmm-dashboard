-- KAI Phase 1E runtime-test fix: exact question and alias coverage.

INSERT OR IGNORE INTO `kai_question_library`
	(`question`, `intent`, `domain`, `required_metric`, `response_type`)
VALUES
	('ยอดขายเดือนนี้', 'SALES_CURRENT_MONTH', 'sales', 'SALES001,SALES002', 'summary'),
	('Sales เดือนนี้', 'SALES_CURRENT_MONTH', 'sales', 'SALES001,SALES002', 'summary'),
	('ยอดขายปัจจุบัน', 'SALES_CURRENT_MONTH', 'sales', 'SALES001,SALES002', 'summary'),
	('ยอดขายเดือน 5 ปี 2023 เทียบกับปีนี้เป็นอย่างไร', 'SALES_YOY_COMPARE', 'sales', 'SALES001,SALES002,SALES005', 'comparison'),
	('ยอดจองเดือนนี้', 'BOOKING_CURRENT_MONTH', 'booking', 'BOOK001', 'summary'),
	('Booking ปัจจุบัน', 'BOOKING_CURRENT_MONTH', 'booking', 'BOOK001', 'summary'),
	('Booking เกิน 90 วันมีกี่คัน', 'BOOKING_AGING', 'booking', 'BOOK003', 'summary'),
	('รถค้าง', 'STOCK_AGING_MODEL', 'stock', 'STOCK003', 'ranking'),
	('Stock เกิน 90 วัน', 'STOCK_AGING_MODEL', 'stock', 'STOCK003', 'ranking'),
	('รถอายุเกิน 90 วัน', 'STOCK_AGING_MODEL', 'stock', 'STOCK003', 'ranking');
--> statement-breakpoint
INSERT OR IGNORE INTO `kai_alias_mapping`
	(`alias_word`, `canonical_term`, `intent`, `domain`)
VALUES
	('ยอดขายเดือนนี้', 'Sales', 'SALES_CURRENT_MONTH', 'sales'),
	('เดือนนี้ขายได้กี่คัน', 'Sales', 'SALES_CURRENT_MONTH', 'sales'),
	('Sales เดือนนี้', 'Sales', 'SALES_CURRENT_MONTH', 'sales'),
	('ยอดขายปัจจุบัน', 'Sales', 'SALES_CURRENT_MONTH', 'sales'),
	('ยอดขายเดือน 5 ปี 2023 เทียบกับปีนี้เป็นอย่างไร', 'Sales', 'SALES_YOY_COMPARE', 'sales'),
	('เดือนนี้จองเท่าไหร่', 'Booking', 'BOOKING_CURRENT_MONTH', 'booking'),
	('ยอดจองเดือนนี้', 'Booking', 'BOOKING_CURRENT_MONTH', 'booking'),
	('Booking ปัจจุบัน', 'Booking', 'BOOKING_CURRENT_MONTH', 'booking'),
	('Booking เกิน 90 วันมีกี่คัน', 'Booking Aging', 'BOOKING_AGING', 'booking'),
	('รถค้าง', 'Stock Aging', 'STOCK_AGING_MODEL', 'stock'),
	('Stock เกิน 90 วัน', 'Stock Aging', 'STOCK_AGING_MODEL', 'stock'),
	('รถอายุเกิน 90 วัน', 'Stock Aging', 'STOCK_AGING_MODEL', 'stock');
