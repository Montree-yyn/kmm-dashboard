-- Agriculture A01: global crop, crop-stage, and season master.
-- Local Operations D1 only for Phase 1. No operational or sample opportunity data.
CREATE TABLE IF NOT EXISTS `agri_crops` (
  `crop_id` text PRIMARY KEY NOT NULL,
  `crop_code` text NOT NULL UNIQUE,
  `crop_name` text NOT NULL,
  `crop_cycle_type` text NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crops_active_idx` ON `agri_crops` (`is_active`, `crop_code`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_crop_stages` (
  `stage_id` text PRIMARY KEY NOT NULL,
  `crop_id` text NOT NULL,
  `stage_code` text NOT NULL,
  `stage_name` text NOT NULL,
  `display_order` integer NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agri_crop_stages_crop_code_unique` ON `agri_crop_stages` (`crop_id`, `stage_code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_crop_stages_crop_order_idx` ON `agri_crop_stages` (`crop_id`, `display_order`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_seasons` (
  `season_id` text PRIMARY KEY NOT NULL,
  `season_code` text NOT NULL UNIQUE,
  `season_name` text NOT NULL,
  `country_code` text,
  `notes` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_seasons_active_idx` ON `agri_seasons` (`is_active`, `season_code`);
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crops` (`crop_id`, `crop_code`, `crop_name`, `crop_cycle_type`, `created_by`, `updated_by`) VALUES
  ('crop-rice', 'RICE', 'Rice', 'ANNUAL', 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('crop-maize', 'MAIZE', 'Maize', 'ANNUAL', 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('crop-rubber', 'RUBBER', 'Rubber', 'PERENNIAL', 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('crop-green-gram', 'GREEN_GRAM', 'Green gram', 'MULTI_SEASON_ANNUAL', 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('crop-black-gram', 'BLACK_GRAM', 'Black gram', 'MULTI_SEASON_ANNUAL', 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('crop-groundnut', 'GROUNDNUT', 'Groundnut', 'ANNUAL', 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('crop-sesame', 'SESAME', 'Sesame', 'ANNUAL', 'local-agriculture-phase1', 'local-agriculture-phase1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_stages` (`stage_id`, `crop_id`, `stage_code`, `stage_name`, `display_order`, `created_by`, `updated_by`) VALUES
  ('stage-RICE-LAND_PREPARATION', 'crop-rice', 'LAND_PREPARATION', 'Land preparation', 10, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-NURSERY_SEED_PREP', 'crop-rice', 'NURSERY_SEED_PREP', 'Nursery / seed preparation', 20, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-SOWING', 'crop-rice', 'SOWING', 'Sowing', 30, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-TRANSPLANTING_DIRECT_SEEDING', 'crop-rice', 'TRANSPLANTING_DIRECT_SEEDING', 'Transplanting / direct seeding', 40, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-TILLERING', 'crop-rice', 'TILLERING', 'Tillering', 50, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-PANICLE_INITIATION', 'crop-rice', 'PANICLE_INITIATION', 'Panicle initiation', 60, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-FLOWERING', 'crop-rice', 'FLOWERING', 'Flowering', 70, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-GRAIN_FILLING', 'crop-rice', 'GRAIN_FILLING', 'Grain filling', 80, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-MATURITY', 'crop-rice', 'MATURITY', 'Maturity', 90, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-HARVEST', 'crop-rice', 'HARVEST', 'Harvest', 100, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RICE-POST_HARVEST', 'crop-rice', 'POST_HARVEST', 'Post-harvest', 110, 'local-agriculture-phase1', 'local-agriculture-phase1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_stages` (`stage_id`, `crop_id`, `stage_code`, `stage_name`, `display_order`, `created_by`, `updated_by`) VALUES
  ('stage-MAIZE-LAND_PREPARATION', 'crop-maize', 'LAND_PREPARATION', 'Land preparation', 10, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-PLANTING', 'crop-maize', 'PLANTING', 'Planting', 20, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-EMERGENCE', 'crop-maize', 'EMERGENCE', 'Emergence', 30, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-VEGETATIVE', 'crop-maize', 'VEGETATIVE', 'Vegetative', 40, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-TASSELING', 'crop-maize', 'TASSELING', 'Tasseling', 50, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-SILKING', 'crop-maize', 'SILKING', 'Silking', 60, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-GRAIN_FILLING', 'crop-maize', 'GRAIN_FILLING', 'Grain filling', 70, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-MATURITY', 'crop-maize', 'MATURITY', 'Maturity', 80, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-HARVEST', 'crop-maize', 'HARVEST', 'Harvest', 90, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-MAIZE-POST_HARVEST', 'crop-maize', 'POST_HARVEST', 'Post-harvest', 100, 'local-agriculture-phase1', 'local-agriculture-phase1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_stages` (`stage_id`, `crop_id`, `stage_code`, `stage_name`, `display_order`, `created_by`, `updated_by`) VALUES
  ('stage-GREEN_GRAM-LAND_PREPARATION', 'crop-green-gram', 'LAND_PREPARATION', 'Land preparation', 10, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GREEN_GRAM-SOWING', 'crop-green-gram', 'SOWING', 'Sowing', 20, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GREEN_GRAM-EMERGENCE', 'crop-green-gram', 'EMERGENCE', 'Emergence', 30, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GREEN_GRAM-VEGETATIVE', 'crop-green-gram', 'VEGETATIVE', 'Vegetative', 40, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GREEN_GRAM-FLOWERING', 'crop-green-gram', 'FLOWERING', 'Flowering', 50, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GREEN_GRAM-POD_DEVELOPMENT', 'crop-green-gram', 'POD_DEVELOPMENT', 'Pod development', 60, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GREEN_GRAM-MATURITY', 'crop-green-gram', 'MATURITY', 'Maturity', 70, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GREEN_GRAM-HARVEST', 'crop-green-gram', 'HARVEST', 'Harvest', 80, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GREEN_GRAM-POST_HARVEST', 'crop-green-gram', 'POST_HARVEST', 'Post-harvest', 90, 'local-agriculture-phase1', 'local-agriculture-phase1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_stages` (`stage_id`, `crop_id`, `stage_code`, `stage_name`, `display_order`, `created_by`, `updated_by`) VALUES
  ('stage-BLACK_GRAM-LAND_PREPARATION', 'crop-black-gram', 'LAND_PREPARATION', 'Land preparation', 10, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-BLACK_GRAM-SOWING', 'crop-black-gram', 'SOWING', 'Sowing', 20, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-BLACK_GRAM-EMERGENCE', 'crop-black-gram', 'EMERGENCE', 'Emergence', 30, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-BLACK_GRAM-VEGETATIVE', 'crop-black-gram', 'VEGETATIVE', 'Vegetative', 40, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-BLACK_GRAM-FLOWERING', 'crop-black-gram', 'FLOWERING', 'Flowering', 50, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-BLACK_GRAM-POD_DEVELOPMENT', 'crop-black-gram', 'POD_DEVELOPMENT', 'Pod development', 60, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-BLACK_GRAM-MATURITY', 'crop-black-gram', 'MATURITY', 'Maturity', 70, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-BLACK_GRAM-HARVEST', 'crop-black-gram', 'HARVEST', 'Harvest', 80, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-BLACK_GRAM-POST_HARVEST', 'crop-black-gram', 'POST_HARVEST', 'Post-harvest', 90, 'local-agriculture-phase1', 'local-agriculture-phase1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_stages` (`stage_id`, `crop_id`, `stage_code`, `stage_name`, `display_order`, `created_by`, `updated_by`) VALUES
  ('stage-GROUNDNUT-LAND_PREPARATION', 'crop-groundnut', 'LAND_PREPARATION', 'Land preparation', 10, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GROUNDNUT-SOWING', 'crop-groundnut', 'SOWING', 'Sowing', 20, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GROUNDNUT-EMERGENCE', 'crop-groundnut', 'EMERGENCE', 'Emergence', 30, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GROUNDNUT-FLOWERING', 'crop-groundnut', 'FLOWERING', 'Flowering', 40, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GROUNDNUT-PEGGING', 'crop-groundnut', 'PEGGING', 'Pegging', 50, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GROUNDNUT-POD_DEVELOPMENT', 'crop-groundnut', 'POD_DEVELOPMENT', 'Pod development', 60, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GROUNDNUT-MATURITY', 'crop-groundnut', 'MATURITY', 'Maturity', 70, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GROUNDNUT-HARVEST', 'crop-groundnut', 'HARVEST', 'Harvest', 80, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-GROUNDNUT-DRYING', 'crop-groundnut', 'DRYING', 'Drying', 90, 'local-agriculture-phase1', 'local-agriculture-phase1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_stages` (`stage_id`, `crop_id`, `stage_code`, `stage_name`, `display_order`, `created_by`, `updated_by`) VALUES
  ('stage-SESAME-LAND_PREPARATION', 'crop-sesame', 'LAND_PREPARATION', 'Land preparation', 10, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-SESAME-SOWING', 'crop-sesame', 'SOWING', 'Sowing', 20, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-SESAME-EMERGENCE', 'crop-sesame', 'EMERGENCE', 'Emergence', 30, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-SESAME-VEGETATIVE', 'crop-sesame', 'VEGETATIVE', 'Vegetative', 40, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-SESAME-FLOWERING', 'crop-sesame', 'FLOWERING', 'Flowering', 50, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-SESAME-CAPSULE_DEVELOPMENT', 'crop-sesame', 'CAPSULE_DEVELOPMENT', 'Capsule development', 60, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-SESAME-MATURITY', 'crop-sesame', 'MATURITY', 'Maturity', 70, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-SESAME-HARVEST', 'crop-sesame', 'HARVEST', 'Harvest', 80, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-SESAME-DRYING', 'crop-sesame', 'DRYING', 'Drying', 90, 'local-agriculture-phase1', 'local-agriculture-phase1');
--> statement-breakpoint
INSERT OR IGNORE INTO `agri_crop_stages` (`stage_id`, `crop_id`, `stage_code`, `stage_name`, `display_order`, `created_by`, `updated_by`) VALUES
  ('stage-RUBBER-LAND_PREPARATION', 'crop-rubber', 'LAND_PREPARATION', 'Land preparation', 5, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RUBBER-PLANTING', 'crop-rubber', 'PLANTING', 'Planting', 10, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RUBBER-IMMATURE_GROWTH', 'crop-rubber', 'IMMATURE_GROWTH', 'Immature growth', 20, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RUBBER-MATURE_PLANTATION', 'crop-rubber', 'MATURE_PLANTATION', 'Mature plantation', 30, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RUBBER-TAPPING', 'crop-rubber', 'TAPPING', 'Tapping', 40, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RUBBER-REDUCED_TAPPING', 'crop-rubber', 'REDUCED_TAPPING', 'Reduced tapping', 50, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RUBBER-MAINTENANCE', 'crop-rubber', 'MAINTENANCE', 'Maintenance', 60, 'local-agriculture-phase1', 'local-agriculture-phase1'),
  ('stage-RUBBER-REPLANTING', 'crop-rubber', 'REPLANTING', 'Replanting', 70, 'local-agriculture-phase1', 'local-agriculture-phase1');
