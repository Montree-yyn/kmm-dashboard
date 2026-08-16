-- Agriculture A04: company-scoped field verification workflow.
CREATE TABLE IF NOT EXISTS `agri_field_verifications` (
  `verification_id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `location_id` text NOT NULL,
  `crop_id` text,
  `field_name` text NOT NULL,
  `proposed_value` text NOT NULL,
  `verification_level` text DEFAULT 'V2' NOT NULL,
  `evidence` text NOT NULL,
  `source_id` text,
  `verified_by` text NOT NULL,
  `verified_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `status` text DEFAULT 'PENDING' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_by` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_field_verifications_company_idx` ON `agri_field_verifications` (`company_id`, `status`, `verified_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agri_field_verifications_location_idx` ON `agri_field_verifications` (`location_id`, `crop_id`, `field_name`);
