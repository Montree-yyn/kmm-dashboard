/**
 * Canonical display/storage name for KMM machine models.
 * Formatting variants are resolved here before rows reach any dashboard.
 */
export function canonicalModelName(value: unknown) {
  const model = String(value ?? "").trim().replace(/\s+/g, " ");
  const key = model.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (key === "DC70GPRO") return "DC70G PRO";
  return model;
}
