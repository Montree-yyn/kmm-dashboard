export type StockPhysicalIdentifiers = {
  chassisNumber?: unknown;
  engineNumber?: unknown;
  serialNumber?: unknown;
  stockId?: unknown;
};

function normalizePhysicalIdentifier(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (!raw || /^(?:-|0|N\/?A|NONE|NULL|UNKNOWN)$/.test(raw)) return "";
  return raw.replace(/[^A-Z0-9]/g, "");
}

/** Every populated physical identifier participates in canonical stock entity resolution. */
export function stockPhysicalIdentifierKeys(row: StockPhysicalIdentifiers) {
  return ([
    ["chassis", row.chassisNumber],
    ["engine", row.engineNumber],
    ["serial", row.serialNumber],
    ["stock", row.stockId],
  ] as const).flatMap(([label, value]) => {
    const normalized = normalizePhysicalIdentifier(value);
    return normalized ? [`${label}:${normalized}`] : [];
  });
}
