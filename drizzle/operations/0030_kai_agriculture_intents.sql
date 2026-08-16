-- KAI Agriculture Phase 1: read-only, evidence-gated query plans.
-- These plans only read Agriculture tables and return unavailable when facts
-- are not verified. They do not generate weather, dates, ownership, or scores.
INSERT OR IGNORE INTO `kai_metrics`
  (`metric_code`, `metric_name`, `description`, `formula`, `data_source`, `unit_type`, `business_rule`, `ai_usage`)
VALUES
  ('AGRI001', 'Agriculture Opportunity', 'Verified company-scoped Agriculture opportunity record', 'Read opportunity_score and confidence_score as stored by the deterministic engine', 'OPERATIONS_DB.agri_opportunities', 'Record', 'KAI cannot create or modify score, confidence, ownership, or recommendation', 'Read, rank, compare, and explain verified opportunity records'),
  ('AGRI002', 'Harvest Soon', 'Verified crop calendar harvest estimate', 'Read agri_calendar_estimates where stage_code is HARVEST', 'OPERATIONS_DB.agri_crop_calendars, agri_calendar_estimates', 'Date', 'Exact dates are unavailable when no township-specific estimate exists', 'Explain sourced harvest windows without inventing dates'),
  ('AGRI003', 'Crop Stage', 'Verified crop stage record', 'Read stage_code from verified calendar records', 'OPERATIONS_DB.agri_crop_calendars', 'Stage', 'Weather and location names cannot substitute for a crop-stage record', 'Read and explain current stage records'),
  ('AGRI004', 'Crop Weather Impact', 'Calibrated crop-weather state', 'Read non-UNKNOWN agri_crop_weather_state rows', 'OPERATIONS_DB.agri_crop_weather_state + shared weather contract', 'State', 'Live weather alone is not a crop impact model', 'Explain recorded crop-weather states'),
  ('AGRI005', 'Customer Priority', 'Verified opportunity linked to a customer', 'Read customer_id-linked opportunity records', 'OPERATIONS_DB.agri_opportunities', 'Record', 'No customer ownership may be inferred', 'Rank verified customer-linked opportunities'),
  ('AGRI006', 'Machine Demand', 'Verified machine or contractor opportunity', 'Read machine_category-linked opportunity records', 'OPERATIONS_DB.agri_opportunities', 'Record', 'No machine ownership or count may be inferred', 'Explain verified machine-demand records'),
  ('AGRI007', 'Agriculture Calendar', 'Baseline and separately recorded estimate', 'Read agri_crop_calendars with optional estimates', 'OPERATIONS_DB.agri_crop_calendars, agri_calendar_estimates', 'Date', 'Baseline is never overwritten by weather adjustment', 'Compare baseline and estimate when both exist'),
  ('AGRI008', 'Agriculture Data Confidence', 'Evidence and confidence status', 'Group agri_crop_locations by confidence_grade and presence_status', 'OPERATIONS_DB.agri_crop_locations, agri_sources', 'Grade', 'KAI cannot generate confidence', 'Explain source and verification gaps');
--> statement-breakpoint
INSERT OR IGNORE INTO `kai_question_library`
  (`question`, `intent`, `domain`, `required_metric`, `response_type`)
VALUES
  ('Top Agriculture opportunities', 'AGRI_TOP_OPPORTUNITIES', 'agriculture', 'AGRI001', 'ranking'),
  ('Which crops are harvesting soon?', 'AGRI_HARVEST_SOON', 'agriculture', 'AGRI002', 'list'),
  ('What is the current crop stage?', 'AGRI_CROP_STAGE', 'agriculture', 'AGRI003', 'list'),
  ('How does weather impact crops?', 'AGRI_WEATHER_IMPACT', 'agriculture', 'AGRI004', 'list'),
  ('Which customers have Agriculture priority?', 'AGRI_CUSTOMER_PRIORITY', 'agriculture', 'AGRI005', 'ranking'),
  ('What machine demand is verified?', 'AGRI_MACHINE_DEMAND', 'agriculture', 'AGRI006', 'ranking'),
  ('Show the Agriculture calendar', 'AGRI_CALENDAR', 'agriculture', 'AGRI007', 'list'),
  ('What is Agriculture data confidence?', 'AGRI_DATA_CONFIDENCE', 'agriculture', 'AGRI008', 'summary'),
  ('โอกาสการขายด้านเกษตรที่สำคัญ', 'AGRI_TOP_OPPORTUNITIES', 'agriculture', 'AGRI001', 'ranking'),
  ('พืชไหนใกล้เก็บเกี่ยว', 'AGRI_HARVEST_SOON', 'agriculture', 'AGRI002', 'list'),
  ('ระยะของพืชปัจจุบันคืออะไร', 'AGRI_CROP_STAGE', 'agriculture', 'AGRI003', 'list'),
  ('สภาพอากาศกระทบพืชอย่างไร', 'AGRI_WEATHER_IMPACT', 'agriculture', 'AGRI004', 'list'),
  ('ข้อมูลเกษตรมีความเชื่อมั่นเท่าไร', 'AGRI_DATA_CONFIDENCE', 'agriculture', 'AGRI008', 'summary');
--> statement-breakpoint
INSERT OR IGNORE INTO `kai_query_templates`
  (`intent`, `purpose`, `required_data`, `query_logic`)
VALUES
  ('AGRI_TOP_OPPORTUNITIES', 'Rank verified Agriculture opportunities', 'agri_opportunities.company_id, scores, confidence, status', '{"version":2,"source":"agriculture","operation":"agri_top_opportunities","limit":5}'),
  ('AGRI_HARVEST_SOON', 'List verified harvest estimates', 'agri_crop_calendars.stage_code, agri_calendar_estimates.estimated_start_date', '{"version":2,"source":"agriculture","operation":"agri_harvest_soon","limit":5}'),
  ('AGRI_CROP_STAGE', 'Read verified crop stage records', 'agri_crop_calendars.stage_code, location_id, crop_id', '{"version":2,"source":"agriculture","operation":"agri_crop_stage","limit":5}'),
  ('AGRI_WEATHER_IMPACT', 'Read calibrated crop-weather states', 'agri_crop_weather_state.state_status, weather_variable, quality_status', '{"version":2,"source":"agriculture","operation":"agri_weather_impact","limit":5}'),
  ('AGRI_CUSTOMER_PRIORITY', 'Rank customer-linked Agriculture opportunities', 'agri_opportunities.company_id, customer_id, scores', '{"version":2,"source":"agriculture","operation":"agri_customer_priority","limit":5}'),
  ('AGRI_MACHINE_DEMAND', 'Rank verified machine-demand records', 'agri_opportunities.company_id, machine_category, scores', '{"version":2,"source":"agriculture","operation":"agri_machine_demand","limit":5}'),
  ('AGRI_CALENDAR', 'Read baseline and current estimate separately', 'agri_crop_calendars, agri_calendar_estimates', '{"version":2,"source":"agriculture","operation":"agri_calendar","limit":5}'),
  ('AGRI_DATA_CONFIDENCE', 'Summarize Agriculture verification coverage', 'agri_crop_locations.confidence_grade, agri_sources', '{"version":2,"source":"agriculture","operation":"agri_data_confidence"}');
--> statement-breakpoint
INSERT OR IGNORE INTO `kai_response_templates`
  (`intent`, `response_structure`)
VALUES
  ('AGRI_TOP_OPPORTUNITIES', 'Verified opportunity ranking; location; crop; stage; score; confidence; source'),
  ('AGRI_HARVEST_SOON', 'Verified harvest estimate; location; crop; stage; baseline; estimate; source'),
  ('AGRI_CROP_STAGE', 'Verified crop stage; location; crop; crop year; confidence; source'),
  ('AGRI_WEATHER_IMPACT', 'Calibrated crop-weather state; location; crop; variable; status; quality; source'),
  ('AGRI_CUSTOMER_PRIORITY', 'Verified customer-linked opportunity; location; crop; score; confidence; source'),
  ('AGRI_MACHINE_DEMAND', 'Verified machine-demand record; location; crop; machine; score; confidence; source'),
  ('AGRI_CALENDAR', 'Baseline versus current estimate; location; crop; stage; verification; source'),
  ('AGRI_DATA_CONFIDENCE', 'Confidence and presence groups; verified count; source count; gaps');
