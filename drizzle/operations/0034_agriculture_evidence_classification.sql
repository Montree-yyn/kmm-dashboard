-- Agriculture evidence classification refinement: Local Operations D1 only.
-- Processing evidence confirms a local rubber value-chain presence, not a
-- township acreage survey or current crop stage.
UPDATE `agri_crop_locations`
SET `presence_status` = 'CONFIRMED_PRESENT',
    `notes` = 'PROCESSING / VALUE_CHAIN_EVIDENCE: local RSS3 group processing facility evidence supports local rubber value-chain presence. Not an acreage survey; current stage remains UNKNOWN.',
    `updated_by` = 'local-agriculture-master-pass'
WHERE `location_id` = 'MM-MON-THANBYUZAYAT'
  AND `crop_id` = 'crop-rubber'
  AND `source_id` = 'source-phase1a14-thanbyuzayat-rubber';
