-- Commission Phase C1 was provisioned in Production by the independent
-- production-commission lineage before this Operations migration chain ran.
-- Keep this migration as a no-op so the canonical history records that state
-- without attempting to add an existing column.
SELECT 1;
