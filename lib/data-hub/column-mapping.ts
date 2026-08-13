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

function canonicalModelValue(value: unknown) {
  const model = String(value ?? "").trim().replace(/\s+/g, " ");
  return model.toUpperCase().replace(/[^A-Z0-9]/g, "") === "DC70GPRO" ? "DC70G PRO" : model;
}

const aliases: Record<string, string[]> = {
  sale_date: ["sale date", "sales date", "delivery date", "date", "transaction date"],
  booking_date: ["booking date", "date"],
  as_of_date: ["as of date", "snapshot date", "today"],
  expense_date: ["expense date", "date"],
  activity_date: ["activity date", "date"],
  invoice_no: ["invoice", "invoice no", "invoice number", "document no", "sale memo no 2"],
  booking_no: ["booking no", "booking number", "booking id", "no bk"],
  branch_code: ["branch code", "branch id"],
  branch_name: ["branch name", "showroom"],
  customer_name: ["customer name", "customer"],
  product_type: ["product type", "type", "product group", "category"],
  product_model: ["product model", "model", "model name"],
  booking_price: ["booking price", "price", "booking amount"],
  deposit_amount: ["deposit amount", "deposit", "down payment"],
  booking_status: ["booking status"],
  purchase_status: ["purchase status", "purchase", "hot status"],
  purchase_type: ["purchase type", "payment type"],
  leasing: ["leasing", "finance type"],
  month_out: ["month out"],
  sales_memo_no: ["sales memo no", "sale memo no"],
  sale_memo_no: ["sale memo no", "sales memo no"],
  delivery_or_cancel_date: ["delivery dete cancer date", "delivery date cancel date", "delivery or cancel date"],
  remark: ["remark", "remarks"],
  stock_date: ["stock date", "day in", "date in"],
  day_in: ["day in", "stock date", "date in"],
  day_out: ["day out"],
  product_code: ["product code"],
  product_group: ["product group", "category"],
  sub_type: ["sub type", "subtype"],
  kmm_flag: ["kmm flag", "kmm", "kmm stock"],
  msrp: ["msrp", "msrp mmk", "retail price"],
  stock_status: ["status pd", "stock status"],
  stock_number: ["stock number", "stock code", "stock id"],
  serial_number: ["serial number", "serial"],
  engine_number: ["engine number", "engine"],
  chassis_number: ["chassis number", "chassis"],
  stock_age_days: ["stock age days", "age stock", "age days"],
  snapshot_date: ["snapshot date", "today", "as of date"],
  sale_branch: ["sale branch"],
  model_code: ["model", "model name", "model code", "product model"],
  product: ["product", "product name", "model", "model name"],
  employee_code: ["sales code", "salesman", "sales", "sl name", "sales name", "employee code"],
  salesperson_code: ["sales code", "salesperson code", "salesman code", "sl code"],
  salesperson_name: ["sales man", "salesperson name", "salesman name", "sl name", "sales name"],
  model: ["model", "model name", "model code"],
  final_received: ["final received", "final amount", "received amount"],
  net_received: ["net received", "net amount"],
  gp1: ["gp1", "gross profit", "gross profit 1", "gp"],
  expense: ["expense", "expenses", "total expense"],
  // CPI's standalone "Total" is the Commission amount. Do not broaden this
  // to Expense or Total Expense, which are a different verified field.
  commission: ["total", "commission", "commission total"],
  gp_percent: ["percent gp", "gp percent", "percent gross profit"],
  sales_value: ["price", "sales amount", "sale amount", "sales value", "amount"],
  sale_amount: ["price", "sales amount", "sale amount", "sales value", "amount"],
  quantity: ["quantity", "qty", "unit", "units"],
  branch: ["branch", "branch name", "dealer"],
  customer: ["customer", "customer name", "cs name"],
  township: ["township", "township name"],
  campaign: ["campaign", "campaign name"],
  status: ["status"],
  category: ["category", "expense category"],
  amount: ["amount", "expense amount"],
  employee_id: ["employee id", "employee code"],
  name: ["name", "employee name"],
  position: ["position", "role", "job title"],
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/%/g, " percent ").replace(/[_\-]+/g, " ").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
}

function storageKey(module: DataModule, companyId?: string) {
  return `kmm-data-hub-column-mapping:${companyId?.trim() || "legacy-kmm"}:${module}`;
}

function statusFor(source: DataSourceDefinition, fieldKey: string | null): MappingStatus {
  if (!fieldKey) return "ignored";
  const field = source.fields.find((item) => item.key === fieldKey);
  if (!field) return "ignored";
  if (field.key === "employee_code" || !field.required) return "warning";
  return "mapped";
}

export function loadSavedMapping(module: DataModule, companyId?: string): SavedMapping {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(module, companyId)) ?? "{}") as SavedMapping;
  } catch {
    return {};
  }
}

export function saveMapping(module: DataModule, mappings: ColumnMapping[], companyId?: string) {
  const mapping: SavedMapping = Object.fromEntries(
    mappings
      .filter((item) => item.excelColumn !== "—")
      .map((item) => [normalize(item.excelColumn), item.fieldKey]),
  );
  window.localStorage.setItem(storageKey(module, companyId), JSON.stringify(mapping));
}

export function createColumnMappings(
  source: DataSourceDefinition,
  headers: string[],
  savedMapping: SavedMapping = {},
  inferredFields: string[] = [],
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
  inferredFields.forEach((field) => mapped.add(field));
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
  const headers = [...new Set([
    ...activeMappings.map((mapping) => mapping.fieldKey),
    ...(file.inferredFields ?? []),
    ...Object.keys(file.canonicalCopies ?? {}),
  ])];
  const rows: ImportRow[] = file.rows.map((row) => {
    const canonical = Object.fromEntries(
      activeMappings.map((mapping) => [mapping.fieldKey, normalizeCanonicalValue(mapping.fieldKey, row[mapping.excelColumn])]),
    );
    Object.entries(file.canonicalCopies ?? {}).forEach(([target, source]) => {
      if (canonical[target] === undefined && canonical[source] !== undefined) canonical[target] = canonical[source];
    });
    // KMM CPI has no quantity field. Structure detection sets this rule only
    // after it proves each retained row has a complete one-unit Sales signature.
    if (file.quantityRule === "one_per_verified_sales_transaction" && canonical.quantity === undefined) canonical.quantity = 1;
    // KMM Stock is row-oriented. Structure detection applies this only after
    // incomplete, title and summary rows have failed the physical-record signature.
    if (file.quantityRule === "one_per_verified_stock_record" && canonical.quantity === undefined) canonical.quantity = 1;
    if (file.bookingStatusRule === "month_out_lifecycle" && Object.hasOwn(canonical, "month_out")) {
      // This is the existing approved Booking rule, not a new status guess:
      // Purchase Status remains independent and Month Out owns lifecycle status.
      const status = deriveBookingLifecycleStatus(canonical.month_out);
      canonical.status = status;
      canonical.booking_status = status;
    }
    return canonical;
  });
  return { ...file, headers, rows };
}

function normalizeCanonicalValue(fieldKey: string, value: unknown) {
  const numericFields = ["quantity", "sale_amount", "sales_value", "msrp", "net_received", "final_received", "expense", "commission", "gp1", "gp_percent", "amount", "booking_price", "deposit_amount", "price", "deposit", "kmm_flag", "stock_age_days"];
  if (numericFields.includes(fieldKey) && /^(?:-|—|n\/?a)$/i.test(String(value ?? "").trim())) return null;
  if (fieldKey === "branch") {
    const branch = String(value ?? "").trim();
    const kmmBranch = branch.match(/^KMM0?(\d+)$/i);
    return kmmBranch ? `KMM${kmmBranch[1].padStart(2, "0")}` : value;
  }
  if (fieldKey === "purchase_status" || fieldKey === "stock_status") {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }
  if (["model", "model_code", "product_model"].includes(fieldKey)) {
    return canonicalModelValue(value);
  }
  if (fieldKey === "month_out") {
    return value === null || value === undefined || String(value).trim() === "" ? value : String(value).trim();
  }
  if (["invoice_no", "booking_no", "stock_number", "serial_number", "engine_number", "chassis_number", "product_code"].includes(fieldKey)) {
    return value === null || value === undefined || String(value).trim() === "" ? value : String(value).trim();
  }
  if (!["sale_date", "booking_date", "as_of_date", "stock_date", "expense_date", "activity_date", "snapshot_date", "day_in", "day_out", "delivery_or_cancel_date"].includes(fieldKey)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const match = String(value ?? "").trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/);
  if (!match) return value;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return value;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function deriveBookingLifecycleStatus(monthOut: unknown) {
  const value = String(monthOut ?? "").trim().toUpperCase();
  if (value.includes("CANC")) return "Cancelled";
  return value ? "Delivered" : "Open";
}

export function isMappableModule(module: DataModule, masterDataType: MasterDataType) {
  void masterDataType;
  return module !== "master_data";
}
