-- Agriculture A06: company-scoped service providers and deterministic opportunities.
CREATE TABLE IF NOT EXISTS `agri_service_providers` (
  `provider_id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `provider_type` text NOT NULL,
  `location_id` text,
  `service_area` text,
  `machine_type` text,
  `brand` text,
  `model` text,
  `machine_count` integer,
  `primary_crop` text,
  `customer_id` text,
  `salesperson_id` text,
  `last_verified` text,
  `status` text DEFAULT 'UNKNOWN' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_service_providers_company_idx` ON `agri_service_providers` (`company_id`, `location_id`, `provider_type`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agri_opportunities` (
  `opportunity_id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `location_id` text,
  `crop_id` text,
  `season_id` text,
  `stage_code` text,
  `opportunity_type` text NOT NULL,
  `machine_category` text,
  `product_id` text,
  `customer_id` text,
  `service_provider_id` text,
  `salesperson_id` text,
  `sales_territory_id` text,
  `opportunity_score` integer,
  `confidence_score` integer,
  `priority_score` integer,
  `days_to_window` integer,
  `window_start` text,
  `window_end` text,
  `weather_risk_score` integer,
  `weather_suitability_score` integer,
  `reason_codes` text DEFAULT '[]' NOT NULL,
  `recommended_action` text,
  `model_version` text NOT NULL,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `expires_at` text,
  `created_by` text NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_opportunities_company_status_idx` ON `agri_opportunities` (`company_id`, `status`, `priority_score`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_opportunities_company_filter_idx` ON `agri_opportunities` (`company_id`, `location_id`, `crop_id`, `salesperson_id`, `confidence_score`);
