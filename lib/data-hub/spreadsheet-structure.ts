export const HEADER_SCAN_LIMIT = 20;

export type StructureModule = "sales" | "booking" | "stock";
export type HeaderConfidence = "high" | "medium" | "low" | "manual";

export type HeaderDetection = {
  rowIndex: number;
  rowNumber: number;
  score: number;
  matchedFields: string[];
  confidence: HeaderConfidence;
  detectedModule: StructureModule;
};

type HeaderProfile = {
  aliases: Record<string, string[]>;
  coreFields: string[];
  highMinimum: number;
};

const headerProfiles: Record<StructureModule, HeaderProfile> = {
  sales: {
    aliases: {
      sale_date: ["sale date", "sales date", "delivery date", "transaction date", "date"],
      invoice_no: ["invoice", "invoice no", "invoice number", "document no", "sale memo no 2"],
      branch: ["branch", "branch name", "dealer", "showroom"],
      model_code: ["model", "model code", "model name", "product model"],
      product_type: ["type", "product type", "product group", "category"],
      employee_code: ["employee code", "sales code", "salesman code", "sl code"],
      salesperson_name: ["sales man", "salesman", "salesperson name", "salesman name", "sl name", "sales name"],
      quantity: ["quantity", "qty", "unit", "units"],
      sale_amount: ["sale amount", "sales amount", "sales value", "amount", "price"],
      msrp: ["msrp", "msrp mmk", "retail price"],
      net_received: ["net received", "net amount"],
      final_received: ["final received", "final amount", "received amount"],
      expense: ["expense", "expenses", "total expense"],
      commission: ["total", "commission", "commission total"],
      gp1: ["gp1", "gross profit", "gross profit 1"],
      gp_percent: ["percent gp", "gp percent", "percent gross profit"],
    },
    coreFields: ["sale_date", "invoice_no", "branch", "model_code"],
    highMinimum: 5,
  },
  booking: {
    aliases: {
      booking_date: ["booking date", "date"],
      booking_no: ["booking no", "booking number", "booking id", "no bk"],
      branch: ["branch", "branch name", "dealer", "showroom"],
      salesperson_name: ["sales man", "salesperson name", "salesman name", "sl name", "sales name"],
      customer: ["customer", "customer name", "cs name"],
      product_type: ["product type", "type", "product group", "category"],
      product_model: ["product model", "model", "model name"],
      booking_price: ["booking price", "price", "booking amount"],
      deposit_amount: ["deposit amount", "deposit", "down payment"],
      purchase_type: ["purchase type", "payment type"],
      leasing: ["leasing", "finance type"],
      purchase_status: ["purchase status", "purchase", "hot status"],
      month_out: ["month out"],
      sales_memo_no: ["sales memo no", "sale memo no"],
      delivery_or_cancel_date: ["delivery dete cancer date", "delivery date cancel date", "delivery or cancel date"],
      remark: ["remark", "remarks"],
      status: ["status"],
      booking_status: ["booking status"],
    },
    coreFields: ["booking_date", "booking_no", "branch", "product_model"],
    highMinimum: 5,
  },
  stock: {
    aliases: {
      as_of_date: ["as of date", "snapshot date", "today"],
      branch: ["branch", "branch name", "dealer"],
      stock_number: ["stock number", "stock code", "stock id"],
      product_code: ["product code"],
      product_type: ["product type", "type"],
      sub_type: ["sub type", "subtype"],
      product_model: ["product model", "model", "model name"],
      chassis_number: ["chassis number", "chassis"],
      engine_number: ["engine number", "engine"],
      msrp: ["msrp", "msrp mmk", "retail price"],
      kmm_flag: ["kmm", "kmm flag", "kmm stock"],
      stock_status: ["status pd", "stock status"],
      stock_date: ["day in", "stock date", "date in"],
      stock_age_days: ["age stock", "stock age days", "age days"],
      day_out: ["day out"],
      sale_branch: ["sale branch"],
      customer_name: ["customer name", "customer"],
      sale_memo_no: ["sale memo no", "sales memo no"],
      serial_number: ["serial number", "serial"],
      quantity: ["quantity", "qty", "unit", "units"],
    },
    coreFields: ["as_of_date", "stock_number", "branch", "product_model"],
    highMinimum: 6,
  },
};

const aliasLookups = Object.fromEntries(
  Object.entries(headerProfiles).map(([module, profile]) => {
    const lookup = new Map<string, string>();
    Object.entries(profile.aliases).forEach(([field, values]) => {
      [field, ...values].forEach((value) => lookup.set(normalizeHeader(value), field));
    });
    return [module, lookup];
  }),
) as Record<StructureModule, Map<string, string>>;

export function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/%/g, " percent ")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

export function canonicalFieldForHeader(value: unknown, module: StructureModule = "sales") {
  return aliasLookups[module].get(normalizeHeader(value)) ?? null;
}

export function scoreHeaderRow(row: unknown[], module?: StructureModule) {
  const modules = module ? [module] : (["sales", "booking", "stock"] as const);
  return modules
    .map((candidateModule) => scoreForProfile(row, candidateModule))
    .sort((left, right) => right.score - left.score || right.matchedFields.length - left.matchedFields.length)[0];
}

function scoreForProfile(row: unknown[], module: StructureModule) {
  const profile = headerProfiles[module];
  const nonEmpty = row.filter((value) => String(value ?? "").trim() !== "");
  const matchedFields = [...new Set(nonEmpty.map((value) => canonicalFieldForHeader(value, module)).filter((field): field is string => Boolean(field)))];
  const numericCells = nonEmpty.filter((value) => typeof value === "number" || /^\d+$/.test(String(value).trim())).length;
  const score = matchedFields.reduce((total, field) => total + (profile.coreFields.includes(field) ? 4 : 2), 0)
    + Math.min(nonEmpty.length, 10) * 0.1
    - (nonEmpty.length ? (numericCells / nonEmpty.length) * 3 : 0);
  return { score, matchedFields, nonEmptyCells: nonEmpty.length, detectedModule: module };
}

export function detectHeaderRow(
  matrix: unknown[][],
  manualHeaderRow?: number,
  module?: StructureModule,
): HeaderDetection {
  if (manualHeaderRow !== undefined) {
    const rowIndex = manualHeaderRow - 1;
    const row = matrix[rowIndex];
    if (!Number.isInteger(manualHeaderRow) || manualHeaderRow < 1 || !row || !row.some((value) => String(value ?? "").trim() !== "")) {
      throw new Error(`Header row ${manualHeaderRow} is empty or outside the worksheet.`);
    }
    const candidate = scoreHeaderRow(row, module);
    return { rowIndex, rowNumber: manualHeaderRow, score: candidate.score, matchedFields: candidate.matchedFields, confidence: "manual", detectedModule: candidate.detectedModule };
  }

  const candidates = matrix.slice(0, HEADER_SCAN_LIMIT).flatMap((row, rowIndex) => {
    if (module) return [{ rowIndex, ...scoreHeaderRow(row, module) }];
    return (["sales", "booking", "stock"] as const).map((candidateModule) => ({ rowIndex, ...scoreForProfile(row, candidateModule) }));
  });
  const strongest = candidates.sort((left, right) => right.score - left.score || right.matchedFields.length - left.matchedFields.length || left.rowIndex - right.rowIndex)[0]
    ?? { rowIndex: 0, score: 0, matchedFields: [], nonEmptyCells: 0, detectedModule: module ?? "sales" };
  const profile = headerProfiles[strongest.detectedModule];
  const coreMatches = strongest.matchedFields.filter((field) => profile.coreFields.includes(field)).length;
  const confidence: HeaderConfidence = strongest.matchedFields.length >= profile.highMinimum && coreMatches >= 3
    ? "high"
    : strongest.matchedFields.length >= 3 && coreMatches >= 2
      ? "medium"
      : "low";
  return { rowIndex: strongest.rowIndex, rowNumber: strongest.rowIndex + 1, score: strongest.score, matchedFields: strongest.matchedFields, confidence, detectedModule: strongest.detectedModule };
}

export function isSummaryLikeRow(row: unknown[]) {
  const labels = row.slice(0, 8).map(normalizeHeader).filter(Boolean);
  return labels.some((label) => /^(?:grand_)?total$|^sub_?total$|^summary$|^end_of_(?:report|data)$/.test(label));
}

export function isBlankRow(row: unknown[]) {
  return !row.some((value) => value !== null && value !== undefined && String(value).trim() !== "");
}

function canonicalValues(row: Record<string, unknown>, headers: string[], module: StructureModule) {
  const values = new Map<string, unknown>();
  headers.forEach((header) => {
    const canonical = canonicalFieldForHeader(header, module);
    if (canonical && !values.has(canonical)) values.set(canonical, row[header]);
  });
  return values;
}

function hasValues(values: Map<string, unknown>, fields: string[]) {
  return fields.every((field) => {
    const value = values.get(field);
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

export function isVerifiedSalesTransactionRow(row: Record<string, unknown>, headers: string[], requireUnitIdentity = true) {
  const values = canonicalValues(row, headers, "sales");
  const requiredFields = ["sale_date", "invoice_no", "branch", "model_code"];
  if (requireUnitIdentity) requiredFields.push("product_type");
  return hasValues(values, requiredFields);
}

export function isVerifiedBookingTransactionRow(row: Record<string, unknown>, headers: string[]) {
  const values = canonicalValues(row, headers, "booking");
  // This mirrors the approved Booking loader: every retained source row is a
  // transaction/unit and must carry its own booking, dealer, salesperson and product signature.
  return hasValues(values, ["booking_date", "booking_no", "branch", "salesperson_name", "product_type"]);
}

export function isVerifiedStockRecordRow(row: Record<string, unknown>, headers: string[]) {
  const values = canonicalValues(row, headers, "stock");
  // The real Stock workbook is row-oriented. Quantity can be inferred only
  // after this complete physical-record signature excludes totals and partial rows.
  return hasValues(values, ["as_of_date", "stock_date", "stock_number", "branch", "product_type", "product_model"]);
}
