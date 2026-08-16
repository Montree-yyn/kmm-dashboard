-- Agriculture A01 additive repair: keep already-applied local migrations safe
-- while aligning Rubber with the Phase 1 crop-stage master contract.
INSERT OR IGNORE INTO `agri_crop_stages`
  (`stage_id`, `crop_id`, `stage_code`, `stage_name`, `display_order`, `created_by`, `updated_by`)
VALUES
  ('stage-RUBBER-LAND_PREPARATION', 'crop-rubber', 'LAND_PREPARATION', 'Land preparation', 5, 'local-agriculture-phase1', 'local-agriculture-phase1');
