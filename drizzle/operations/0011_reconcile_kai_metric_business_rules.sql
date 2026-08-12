UPDATE `kai_metrics`
SET `business_rule` = '0-30 วัน = Normal; 31-60 วัน = Monitor; 61-90 วัน = Risk; มากกว่า 90 วัน = Critical; รายละเอียดอ้างอิง kai_business_rules'
WHERE `metric_code` = 'BOOK003';
--> statement-breakpoint
UPDATE `kai_metrics`
SET `business_rule` = '0-90 วัน = Healthy; 91-180 วัน = Monitor; 181-365 วัน = Slow Moving; มากกว่า 365 วัน = Critical; รายละเอียดอ้างอิง kai_business_rules'
WHERE `metric_code` = 'STOCK003';
--> statement-breakpoint
UPDATE `kai_metrics`
SET `business_rule` = '181-365 วัน = Slow Moving; มากกว่า 365 วัน = Critical; รายละเอียดอ้างอิง kai_business_rules'
WHERE `metric_code` = 'STOCK004';
