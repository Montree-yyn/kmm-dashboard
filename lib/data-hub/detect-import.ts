import type {
  DataModule,
  DetectionConfidence,
  DetectionEvidence,
  DetectedValue,
  ImportDetection,
  ImportRow,
  ParsedImportSheet,
} from "./types";

type DetectionInput = {
  filename: string;
  sheets: ParsedImportSheet[];
  metadata?: Record<string, unknown>;
};

const salesFields = ["sale_date", "invoice_no", "branch", "model_code", "quantity", "sale_amount"];
const unsupportedModules: Array<[string, DataModule]> = [["booking", "booking"], ["stock", "stock"], ["expense", "expense"], ["marketing", "marketing"], ["target", "team"]];

export function detectImportMetadata({ filename, sheets, metadata = {} }: DetectionInput): ImportDetection {
  const nonEmpty = sheets.filter((sheet) => sheet.rows.length > 0 && sheet.isDataCandidate !== false);
  const signatureCandidates = [...nonEmpty].sort((a, b) => (b.headerScore ?? 0) - (a.headerScore ?? 0) || b.rows.length - a.rows.length);
  const salesCandidates = signatureCandidates.filter((sheet) => sheet.isSalesCandidate).sort((a, b) => b.salesScore - a.salesScore || b.rows.length - a.rows.length);
  const warnings: string[] = [];
  if (findToken(metadata.company) && findToken(metadata.company_code) && findToken(metadata.company) !== findToken(metadata.company_code)) warnings.push("Workbook metadata contains conflicting company values.");
  if (numberValue(metadata.year) !== null && numberValue(metadata.date_year) !== null && numberValue(metadata.year) !== numberValue(metadata.date_year)) warnings.push("Workbook metadata contains conflicting year values.");
  const primaryModule = signatureCandidates[0]?.detectedModule ?? (salesCandidates.length ? "sales" : undefined);
  const detectedCandidates = signatureCandidates.filter((sheet) => primaryModule === "sales" ? sheet.detectedModule === "sales" || sheet.isSalesCandidate : sheet.detectedModule === primaryModule);
  if (detectedCandidates.length > 1) warnings.push(`Multiple sheets appear to contain ${primaryModule ?? "transaction"} data. Confirm the correct sheet before import.`);
  const sheet = signatureCandidates[0] ?? salesCandidates[0];
  if (!sheet) return unknownDetection(["The workbook contains no data rows."]);

  const company = detectCompany(filename, sheets, metadata);
  const detectedModule = detectModule(filename, sheet, metadata);
  const year = detectPeriod(sheet.rows, sheet.headers, "year", filename, metadata, sheet.detectedModule);
  const month = detectPeriod(sheet.rows, sheet.headers, "month", filename, metadata, sheet.detectedModule);
  const businessWeek = detectNumber(sheet.rows, sheet.headers, ["business_week", "week", "week_no"], "Business week");
  return { company, module: detectedModule, year, month, businessWeek, warnings, candidateSheets: detectedCandidates.map((item) => item.name) };
}

function detectCompany(filename: string, sheets: ParsedImportSheet[], metadata: Record<string, unknown>): DetectedValue<string | null> {
  const explicit = findToken(metadata.company ?? metadata.company_code);
  if (explicit) return found(explicit, "high", [{ source: "workbook_metadata", detail: "Workbook metadata" }]);
  for (const sheet of sheets) {
    for (const row of sheet.rows.slice(0, 100)) {
      const header = Object.keys(row).find((key) => ["company", "company_code", "company_id"].includes(key));
      const value = header ? findToken(row[header]) : null;
      if (value) return found(value, "high", [{ source: "column_value", detail: `${header} column` }]);
    }
  }
  const sheetMatch = sheets.map((item) => item.name).map(companyToken).find(Boolean);
  if (sheetMatch) return found(sheetMatch, "medium", [{ source: "sheet_name", detail: "Sheet name" }]);
  const filenameMatch = companyToken(filename);
  return filenameMatch ? found(filenameMatch, "low", [{ source: "filename", detail: "Filename" }]) : unknownValue();
}

function detectModule(filename: string, sheet: ParsedImportSheet, metadata: Record<string, unknown>): DetectedValue<DataModule | null> {
  const explicit = moduleToken(metadata.module);
  if (explicit) return found(explicit, "high", [{ source: "workbook_metadata", detail: "Workbook metadata" }]);
  if (sheet.detectedModule) return found(sheet.detectedModule, "high", [{ source: "column_value", detail: `${sheet.detectedModule} header signature` }]);
  if (sheet.isSalesCandidate) return found("sales", "high", [{ source: "column_value", detail: "Sales header signature" }]);
  const lower = `${sheet.name} ${filename}`.toLowerCase();
  const match = unsupportedModules.find(([token]) => lower.includes(token));
  return match ? found(match[1], "low", [{ source: lower.includes(sheet.name.toLowerCase()) ? "sheet_name" : "filename", detail: "Module token" }]) : unknownValue();
}

function detectPeriod(rows: ImportRow[], headers: string[], kind: "year" | "month", filename: string, metadata: Record<string, unknown>, module?: "sales" | "booking" | "stock"): DetectedValue<number | null> {
  const explicit = numberValue(metadata[kind]);
  if (explicit !== null) return found(explicit, "high", [{ source: "workbook_metadata", detail: "Workbook metadata" }]);
  const directHeader = headers.find((header) => header === kind || header === `${kind}_no`);
  if (directHeader) {
    const values = rows
      .map((row) => numberValue(row[directHeader]))
      .filter((value): value is number => value !== null && (kind === "month" ? value >= 1 && value <= 12 : value >= 1900 && value <= 2100));
    const common = mostCommon(values);
    if (common !== null) return found(common, "medium", [{ source: "column_value", detail: `${directHeader} column` }]);
  }
  const dateFields = module === "booking"
    ? ["booking_date", "date"]
    : module === "stock"
      ? ["as_of_date", "snapshot_date", "today", "stock_date", "day_in"]
      : ["sale_date", "sales_date", "delivery_date", "transaction_date", "date"];
  const dateHeader = dateFields.find((field) => headers.includes(field))
    ?? (module !== "booking" && module !== "stock" ? headers.find((header) => canonicalHeader(header) === "sale_date") : undefined);
  if (dateHeader) {
    const values = rows.map((row) => { const date = new Date(String(row[dateHeader] ?? "")); return Number.isNaN(date.getTime()) ? null : kind === "year" ? date.getFullYear() : date.getMonth() + 1; }).filter((value): value is number => value !== null);
    const common = mostCommon(values);
    if (common !== null) return found(common, kind === "year" ? "medium" : "low", [{ source: "column_value", detail: `${dateHeader} column` }]);
  }
  const match = filename.match(kind === "year" ? /(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/ : /(?:^|[^a-z])(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[^a-z]|$)/i);
  if (match) return found(kind === "year" ? Number(match[1]) : monthNumber(match[0]), "low", [{ source: "filename", detail: "Filename" }]);
  return unknownValue();
}

function detectNumber(rows: ImportRow[], headers: string[], keys: string[], label: string): DetectedValue<number | null> { const header = headers.find((item) => keys.includes(item)); const value = header ? mostCommon(rows.map((row) => numberValue(row[header])).filter((item): item is number => item !== null)) : null; return value === null ? unknownValue() : found(value, "medium", [{ source: "column_value", detail: `${label} column` }]); }
function unknownDetection(warnings: string[]): ImportDetection { return { company: unknownValue(), module: unknownValue(), year: unknownValue(), month: unknownValue(), businessWeek: unknownValue(), warnings, candidateSheets: [] }; }
function unknownValue<T extends string | number | null>(): DetectedValue<T> { return { value: null as T, confidence: "unknown", evidence: [] }; }
function found<T extends string | number | null>(value: T, confidence: DetectionConfidence, evidence: DetectionEvidence[]): DetectedValue<T> { return { value, confidence, evidence }; }
function findToken(value: unknown) { const token = String(value ?? "").trim().toUpperCase(); return token === "KMM" || token === "KM" ? token : null; }
function companyToken(value: string) { const match = value.toUpperCase().match(/(?:^|[^A-Z])(KMM|KM)(?:[^A-Z]|$)/); return match?.[1] ?? null; }
function moduleToken(value: unknown): DataModule | null { const token = String(value ?? "").toLowerCase(); return token === "sales" ? "sales" : unsupportedModules.find(([name]) => token.includes(name))?.[1] ?? null; }
function numberValue(value: unknown) { const raw = String(value ?? "").trim(); if (!raw) return null; const parsed = Number(raw.replace(/[^0-9.-]/g, "")); return Number.isFinite(parsed) ? parsed : null; }
function mostCommon(values: number[]) { const counts = new Map<number, number>(); values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; }
function monthNumber(value: string) { const token = value.toLowerCase().slice(0, 3); return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(token) + 1; }

export function scoreSalesHeaders(headers: string[]) {
  const canonical = new Set(headers.map(canonicalHeader).filter(Boolean));
  return salesFields.filter((field) => canonical.has(field)).length;
}

function canonicalHeader(value: string) {
  const normalized = value.trim().toLowerCase().replace(/%/g, " percent ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const aliases: Record<string, string> = {
    sale_date: "sale_date", sales_date: "sale_date", delivery_date: "sale_date", transaction_date: "sale_date", date: "sale_date",
    invoice_no: "invoice_no", invoice_number: "invoice_no", sale_memo_no_2: "invoice_no",
    branch: "branch", branch_name: "branch", dealer: "branch",
    model: "model_code", model_code: "model_code", model_name: "model_code", product_model: "model_code",
    quantity: "quantity", qty: "quantity", units: "quantity",
    sale_amount: "sale_amount", sales_amount: "sale_amount", sales_value: "sale_amount", price: "sale_amount",
  };
  return aliases[normalized] ?? normalized;
}
