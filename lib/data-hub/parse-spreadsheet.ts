import * as XLSX from "@e965/xlsx";
import { detectImportMetadata, scoreSalesHeaders } from "./detect-import";
import {
  canonicalFieldForHeader,
  detectHeaderRow,
  isBlankRow,
  isSummaryLikeRow,
  isVerifiedBookingTransactionRow,
  isVerifiedSalesTransactionRow,
  isVerifiedStockRecordRow,
  normalizeHeader,
  type StructureModule,
} from "./spreadsheet-structure";
import type { ImportModule, ImportRow, ParsedImportFile, ParsedImportSheet } from "./types";

const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_ROWS = 50_000;
const HEADER_DETECTION_ERROR = "Header row could not be detected. Select a worksheet and enter the header row manually.";

export type SpreadsheetParseOptions = {
  sheetName?: string;
  headerRow?: number;
  module?: ImportModule;
};

export function normalizeColumnName(value: unknown) {
  return normalizeHeader(value);
}

export async function parseSpreadsheetFile(
  file: File,
  options: SpreadsheetParseOptions = {},
): Promise<ParsedImportFile> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("Choose an XLSX, XLS or CSV file.");
  if (file.size > MAX_FILE_SIZE) throw new Error("The selected file exceeds the 20 MB upload limit.");

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const parsedSheets = workbook.SheetNames.map((name) => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: null, raw: true });
    const manualHeaderRow = name === options.sheetName ? options.headerRow : undefined;
    return parseSheet(matrix, name, manualHeaderRow, options.module);
  }).filter((sheet) => sheet.detectedColumns > 0 || sheet.rows.length > 0);
  if (!parsedSheets.length) throw new Error("The workbook does not contain a data worksheet.");

  const candidates = parsedSheets
    .filter((sheet) => sheet.isDataCandidate)
    .sort((left, right) => right.headerScore - left.headerScore || right.rows.length - left.rows.length);
  const selected = (options.sheetName ? parsedSheets.find((sheet) => sheet.name === options.sheetName) : undefined)
    ?? candidates[0]
    ?? parsedSheets[0];
  if (options.headerRow !== undefined && options.sheetName && selected.structureError) throw new Error(selected.structureError);
  if (selected.rows.length > MAX_ROWS) {
    throw new Error(`This file contains ${selected.rows.length.toLocaleString()} rows. The Phase 1 limit is ${MAX_ROWS.toLocaleString()} rows per import.`);
  }

  const detectionSheets = candidates.length ? candidates : [selected];
  const detection = detectImportMetadata({ filename: file.name, sheets: detectionSheets, metadata: readWorkbookMetadata(workbook) });
  detection.candidateSheets = candidates.map((sheet) => sheet.name);
  if (candidates.length > 1 && !detection.warnings.some((warning) => warning.startsWith("Multiple sheets"))) {
    detection.warnings.push("Multiple sheets contain transaction-like headers. Confirm the correct sheet before validation.");
  }
  if (selected.structureError) detection.warnings.push(selected.structureError);

  return {
    filename: file.name,
    extension: extension as ParsedImportFile["extension"],
    headers: selected.headers,
    rows: selected.rows,
    sheetName: selected.name,
    headerRow: selected.headerRow,
    headerConfidence: selected.headerConfidence,
    detectedColumns: selected.detectedColumns,
    sourceRowNumbers: selected.sourceRowNumbers,
    sourceRowSignatures: selected.sourceRowSignatures,
    structureError: selected.structureError,
    inferredFields: selected.inferredFields,
    canonicalCopies: selected.canonicalCopies,
    quantityRule: selected.quantityRule,
    duplicateRule: selected.duplicateRule,
    bookingStatusRule: selected.bookingStatusRule,
    detectedModule: selected.detectedModule,
    workbookSheetNames: parsedSheets.map((sheet) => sheet.name),
    sheets: candidates,
    detection,
  };
}

export function parseSheetMatrix(
  matrix: unknown[][],
  name: string,
  manualHeaderRow?: number,
  module?: ImportModule,
): ParsedImportSheet {
  return parseSheet(matrix, name, manualHeaderRow, module);
}

function parseSheet(
  matrix: unknown[][],
  name: string,
  manualHeaderRow?: number,
  moduleHint?: ImportModule,
): ParsedImportSheet {
  if (!matrix.length || matrix.every(isBlankRow)) return emptySheet(name, undefined, moduleHint);
  let header;
  try {
    header = detectHeaderRow(matrix, manualHeaderRow, moduleHint);
  } catch (error) {
    return emptySheet(name, error instanceof Error ? error.message : HEADER_DETECTION_ERROR, moduleHint);
  }

  const detectedModule = (moduleHint ?? header.detectedModule) as StructureModule;
  const rawHeaders = matrix[header.rowIndex] ?? [];
  const normalizedHeaders = rawHeaders.map(normalizeColumnName);
  const occurrences = new Map<string, number>();
  const headers = normalizedHeaders.map((column) => {
    if (!column) return "";
    const count = (occurrences.get(column) ?? 0) + 1;
    occurrences.set(column, count);
    return count === 1 ? column : `${column}_${count}`;
  });
  const nonEmptyHeaders = headers.filter(Boolean);
  const detectedColumns = rawHeaders.length;
  const autoDetected = header.confidence === "high" || header.confidence === "medium";
  if (!autoDetected && manualHeaderRow === undefined) {
    return {
      ...emptySheet(name, HEADER_DETECTION_ERROR, detectedModule),
      headerRow: header.rowNumber,
      headerConfidence: header.confidence,
      detectedColumns,
      headerScore: header.score,
    };
  }

  const canonicalHeaders = new Set(nonEmptyHeaders.map((value) => canonicalFieldForHeader(value, detectedModule)).filter(Boolean));
  const salesScore = detectedModule === "sales" ? scoreSalesHeaders(nonEmptyHeaders) : 0;
  const isSalesCandidate = detectedModule === "sales"
    && ["sale_date", "invoice_no", "branch", "model_code"].every((field) => canonicalHeaders.has(field))
    && salesScore >= 4;
  const isBookingCandidate = detectedModule === "booking"
    && ["booking_date", "booking_no", "branch", "product_type", "product_model"].every((field) => canonicalHeaders.has(field));
  const isStockCandidate = detectedModule === "stock"
    && ["as_of_date", "stock_date", "stock_number", "branch", "product_type", "product_model"].every((field) => canonicalHeaders.has(field));

  const hasExplicitQuantity = canonicalHeaders.has("quantity");
  const salesHasUnitIdentity = canonicalHeaders.has("product_type") && canonicalHeaders.has("model_code");
  const quantityRule = isSalesCandidate && !hasExplicitQuantity && salesHasUnitIdentity
    ? "one_per_verified_sales_transaction" as const
    : isStockCandidate && !hasExplicitQuantity
      ? "one_per_verified_stock_record" as const
      : undefined;
  const duplicateRule = isBookingCandidate
    ? "booking_source_rows_are_transactions" as const
    : isStockCandidate
      ? "current_stock_physical_identifier" as const
      : undefined;
  const inferredFields = quantityRule ? ["quantity"] : [];
  const canonicalCopies: Record<string, string> = {};
  let bookingStatusRule: ParsedImportSheet["bookingStatusRule"];

  if (isSalesCandidate && canonicalHeaders.has("model_code")) canonicalCopies.model = "model_code";
  // Sales D1 retains the legacy non-null sale_amount field. For CPI files the
  // exact Final Received value is copied for compatibility; it is never estimated.
  if (isSalesCandidate && !canonicalHeaders.has("sale_amount") && canonicalHeaders.has("final_received")) {
    canonicalCopies.sale_amount = "final_received";
    inferredFields.push("sale_amount");
  }

  if (isBookingCandidate) {
    // The Booking page groups by Product Type. Model remains a separate field,
    // while the legacy required `product` value follows Product Type.
    canonicalCopies.product = "product_type";
    canonicalCopies.model = "product_model";
    canonicalCopies.customer_name = "customer";
    canonicalCopies.price = "booking_price";
    canonicalCopies.deposit = "deposit_amount";
    if (canonicalHeaders.has("month_out")) {
      // Approved Booking parity: Month Out is the lifecycle source; Purchase
      // Status remains the independent A/B/C HOT, S or Fail pipeline value.
      bookingStatusRule = "month_out_lifecycle";
      inferredFields.push("status", "booking_status");
    } else if (canonicalHeaders.has("booking_status") && !canonicalHeaders.has("status")) {
      canonicalCopies.status = "booking_status";
    } else if (canonicalHeaders.has("status") && !canonicalHeaders.has("booking_status")) {
      canonicalCopies.booking_status = "status";
    }
  }

  if (isStockCandidate) {
    canonicalCopies.snapshot_date = "as_of_date";
    canonicalCopies.day_in = "stock_date";
    canonicalCopies.model = "product_model";
    canonicalCopies.product = "product_model";
    // TYPE is the approved product group input. Real SUB_TYPE values (DH/RX/M1)
    // are preserved separately and must not replace this business grouping.
    canonicalCopies.product_group = "product_type";
    if (canonicalHeaders.has("chassis_number") && !canonicalHeaders.has("serial_number")) {
      canonicalCopies.serial_number = "chassis_number";
    }
  }

  const rows: ImportRow[] = [];
  const sourceRowNumbers: number[] = [];
  const sourceRowSignatures: string[] = [];
  matrix.slice(header.rowIndex + 1).forEach((rawRow, offset) => {
    if (isBlankRow(rawRow) || isSummaryLikeRow(rawRow)) return;
    const row = Object.fromEntries(headers.map((column, index) => [column, rawRow[index] ?? null] as const).filter(([column]) => Boolean(column)));
    if (isSalesCandidate && !isVerifiedSalesTransactionRow(row, nonEmptyHeaders, Boolean(quantityRule))) return;
    if (isBookingCandidate && !isVerifiedBookingTransactionRow(row, nonEmptyHeaders)) return;
    if (isStockCandidate && !isVerifiedStockRecordRow(row, nonEmptyHeaders)) return;
    rows.push(row);
    sourceRowNumbers.push(header.rowNumber + offset + 1);
    // A CPI row is the Sales transaction grain. Preserve a deterministic
    // fingerprint of every retained source field before mapping discards
    // non-canonical identity/detail columns such as REF_CODE and chassis.
    // Row numbers are intentionally excluded, so a true repeated source row
    // is still detected while separate units under one invoice remain valid.
    sourceRowSignatures.push(sourceTransactionSignature(row, nonEmptyHeaders));
  });

  const isRecognizedCandidate = isSalesCandidate || isBookingCandidate || isStockCandidate;
  return {
    name,
    headers: nonEmptyHeaders,
    rows,
    headerRow: header.rowNumber,
    headerConfidence: header.confidence,
    detectedColumns,
    sourceRowNumbers,
    sourceRowSignatures,
    inferredFields: [...new Set([...inferredFields, ...Object.keys(canonicalCopies)])],
    canonicalCopies,
    quantityRule,
    duplicateRule,
    bookingStatusRule,
    detectedModule,
    isDataCandidate: rows.length > 0 && (isRecognizedCandidate || manualHeaderRow !== undefined),
    headerScore: header.score,
    isSalesCandidate,
    salesScore,
    isBookingCandidate,
    isStockCandidate,
  };
}

function emptySheet(name: string, structureError?: string, detectedModule?: ImportModule): ParsedImportSheet {
  return {
    name,
    headers: [],
    rows: [],
    headerRow: null,
    headerConfidence: "low",
    detectedColumns: 0,
    sourceRowNumbers: [],
    sourceRowSignatures: [],
    structureError,
    inferredFields: [],
    canonicalCopies: {},
    detectedModule,
    isDataCandidate: false,
    headerScore: 0,
    isSalesCandidate: false,
    salesScore: 0,
    isBookingCandidate: false,
    isStockCandidate: false,
  };
}

function sourceTransactionSignature(row: ImportRow, headers: string[]) {
  return JSON.stringify(headers.map((header) => [header, canonicalSourceValue(row[header])]));
}

function canonicalSourceValue(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return ["empty", ""];
  if (value instanceof Date) {
    return ["date", Number.isNaN(value.getTime()) ? "invalid" : value.toISOString()];
  }
  if (typeof value === "number") {
    return ["number", Number.isFinite(value) ? String(value) : String(value).toLowerCase()];
  }
  if (typeof value === "boolean") return ["boolean", value ? "1" : "0"];
  return ["text", String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()];
}

function readWorkbookMetadata(workbook: unknown) {
  const properties = (workbook as { Props?: Record<string, unknown> }).Props ?? {};
  const metadata: Record<string, unknown> = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key.toLowerCase(), value]));
  const typedWorkbook = workbook as { SheetNames?: string[]; Sheets?: Record<string, unknown> };
  for (const name of typedWorkbook.SheetNames ?? []) {
    if (!/(metadata|config|info)/i.test(name)) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(typedWorkbook.Sheets?.[name] as Parameters<typeof XLSX.utils.sheet_to_json>[0], { header: 1, defval: null, raw: true });
    matrix.slice(0, 25).forEach((row) => {
      const key = normalizeColumnName(row[0]);
      if (key) metadata[key] = row[1];
    });
  }
  return metadata;
}
