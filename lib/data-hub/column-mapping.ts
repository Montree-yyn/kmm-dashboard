import type {
  DataModule,
  DataSourceDefinition,
  ImportRow,
  MasterDataType,
  ParsedImportFile,
} from "./types";

export type MappingStatus = "mapped" | "warning" | "missing" | "ignored";

export type ColumnMapping = {
  excelColumn: string;
  fieldKey: string | null;
  status: MappingStatus;
};

type SavedMapping = Record<string, string | null>;

const aliases: Record<string, string[]> = {
  sale_date: ["sale date", "sales date", "date", "transaction date"],
  booking_date: ["booking date", "date"],
  as_of_date: ["as of date", "stock date", "date"],
  expense_date: ["expense date", "date"],
  activity_date: ["activity date", "date"],
  invoice_no: ["invoice", "invoice no", "invoice number", "document no"],
  booking_no: ["booking no", "booking number", "booking id"],
  model_code: ["model", "model name", "model code", "product model"],
  product: ["product", "product name", "model", "model name"],
  employee_code: ["salesman", "sales", "sl name", "sales name", "employee code"],
  sales_value: ["price", "sales amount", "sale amount", "sales value", "amount"],
  sale_amount: ["price", "sales amount", "sale amount", "sales value", "amount"],
  quantity: ["quantity", "qty", "unit", "units"],
  branch: ["branch", "branch name"],
  customer: ["customer", "customer name"],
  township: ["township", "township name"],
  campaign: ["campaign", "campaign name"],
  status: ["status", "booking status"],
  category: ["category", "expense category"],
  amount: ["amount", "expense amount"],
  employee_id: ["employee id", "employee code"],
  name: ["name", "employee name"],
  position: ["position", "role", "job title"],
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
}

function storageKey(module: DataModule) {
  return `kmm-data-hub-column-mapping:${module}`;
}

function statusFor(source: DataSourceDefinition, fieldKey: string | null): MappingStatus {
  if (!fieldKey) return "ignored";
  const field = source.fields.find((item) => item.key === fieldKey);
  if (!field) return "ignored";
  if (field.key === "employee_code" || !field.required) return "warning";
  return "mapped";
}

export function loadSavedMapping(module: DataModule): SavedMapping {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(module)) ?? "{}") as SavedMapping;
  } catch {
    return {};
  }
}

export function saveMapping(module: DataModule, mappings: ColumnMapping[]) {
  const mapping: SavedMapping = Object.fromEntries(
    mappings
      .filter((item) => item.excelColumn !== "—")
      .map((item) => [normalize(item.excelColumn), item.fieldKey]),
  );
  window.localStorage.setItem(storageKey(module), JSON.stringify(mapping));
}

export function createColumnMappings(
  source: DataSourceDefinition,
  headers: string[],
  savedMapping: SavedMapping = {},
): ColumnMapping[] {
  const claimed = new Set<string>();
  const mappings = headers.map((excelColumn) => {
    const normalized = normalize(excelColumn);
    const saved = savedMapping[normalized];
    const auto = source.fields.find((field) => {
      const candidates = [field.key, field.label, ...(aliases[field.key] ?? [])].map(normalize);
      return candidates.includes(normalized);
    })?.key;
    const fieldKey = saved ?? auto ?? null;
    const duplicate = fieldKey ? claimed.has(fieldKey) : false;
    if (fieldKey) claimed.add(fieldKey);
    return {
      excelColumn,
      fieldKey,
      status: duplicate ? "warning" : statusFor(source, fieldKey),
    };
  });

  const mapped = new Set(mappings.flatMap((item) => (item.fieldKey ? [item.fieldKey] : [])));
  return [
    ...mappings,
    ...source.fields
      .filter((field) => field.required && !mapped.has(field.key))
      .map((field) => ({ excelColumn: "—", fieldKey: field.key, status: "missing" as const })),
  ];
}

export function updateColumnMapping(
  source: DataSourceDefinition,
  mappings: ColumnMapping[],
  excelColumn: string,
  fieldKey: string | null,
) {
  const updated = mappings.map((mapping) =>
    mapping.excelColumn === excelColumn
      ? { ...mapping, fieldKey, status: statusFor(source, fieldKey) }
      : mapping,
  );
  const claimed = new Map<string, number>();
  return updated.map((mapping) => {
    if (!mapping.fieldKey || mapping.excelColumn === "—") return mapping;
    const count = claimed.get(mapping.fieldKey) ?? 0;
    claimed.set(mapping.fieldKey, count + 1);
    return count === 0 ? mapping : { ...mapping, status: "warning" as const };
  });
}

export function applyColumnMappings(
  file: ParsedImportFile,
  mappings: ColumnMapping[],
): ParsedImportFile {
  const activeMappings = mappings.filter(
    (mapping) => mapping.excelColumn !== "—" && mapping.fieldKey,
  ) as Array<ColumnMapping & { fieldKey: string }>;
  const headers = [...new Set(activeMappings.map((mapping) => mapping.fieldKey))];
  const rows: ImportRow[] = file.rows.map((row) =>
    Object.fromEntries(
      activeMappings.map((mapping) => [mapping.fieldKey, row[mapping.excelColumn]]),
    ),
  );
  return { ...file, headers, rows };
}

export function isMappableModule(module: DataModule, masterDataType: MasterDataType) {
  void masterDataType;
  return module !== "master_data";
}
