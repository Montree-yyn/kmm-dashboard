import type {
  DataFieldDefinition,
  DataSourceDefinition,
  ImportRow,
  DuplicateRule,
  QuantityRule,
  ValidationIssue,
  ValidationSummary,
} from "./types";
import { stockPhysicalIdentifierKeys } from "../stock/physical-identifiers";

function isEmpty(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isValidDate(value: unknown) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== "string" && typeof value !== "number") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function matchesType(value: unknown, field: DataFieldDefinition) {
  if (field.type === "string") return typeof value === "string";
  if (field.type === "number") {
    if (typeof value === "number") return Number.isFinite(value);
    return (
      typeof value === "string" &&
      value.trim() !== "" &&
      Number.isFinite(Number(value.replaceAll(",", "")))
    );
  }
  return isValidDate(value);
}

function comparableValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").trim().toLowerCase();
}

function exactSalesTransactionKey(
  source: DataSourceDefinition,
  headers: string[],
  row: ImportRow,
) {
  // Compare only canonical fields that are actually present in this import.
  // Optional blank values remain part of the signature so two otherwise exact
  // rows are still caught without promoting invoice_no to a guessed unique key.
  const fields = source.fields
    .map((field) => field.key)
    .filter((field) => headers.includes(field));
  if (fields.length === 0) return null;
  return JSON.stringify(
    fields.map((field) => [field, comparableValue(row[field])]),
  );
}

export function validateImportRows(
  source: DataSourceDefinition,
  headers: string[],
  rows: ImportRow[],
  options: { quantityRule?: QuantityRule; duplicateRule?: DuplicateRule; sourceRowNumbers?: number[]; sourceRowSignatures?: string[] } = {},
): ValidationSummary {
  const requiredFields = source.fields.filter((field) => field.required);
  const missingColumns = requiredFields
    .filter((field) => !headers.includes(field.key))
    .map((field) => field.key);
  const issues: ValidationIssue[] = missingColumns.map((column) => ({
    code: "missing_column",
    column,
    message: `Missing required column: ${column}`,
  }));
  if (source.id === "stock" && !["branch", "branch_code", "branch_name"].some((column) => headers.includes(column))) {
    missingColumns.push("branch / branch_code / branch_name");
    issues.push({ code: "missing_column", column: "branch", message: "Missing required stock branch identifier." });
  }
  if (source.id === "stock" && !["product", "product_type", "product_model"].some((column) => headers.includes(column))) {
    missingColumns.push("product / product_type / product_model");
    issues.push({ code: "missing_column", column: "product", message: "Missing required stock product identifier." });
  }
  const invalidRows = new Set<number>();
  let emptyCells = 0;
  let wrongTypeCells = 0;
  let duplicateRows = 0;
  let warningCells = 0;

  rows.forEach((row, index) => {
    const displayRow = options.sourceRowNumbers?.[index] ?? index + 2;
    source.fields.forEach((field) => {
      if (!headers.includes(field.key)) return;
      const value = row[field.key];
      if (field.required && isEmpty(value)) {
        emptyCells += 1;
        invalidRows.add(index);
        issues.push({
          code: "empty_cell",
          row: displayRow,
          column: field.key,
          message: `Row ${displayRow}: ${field.label} is empty`,
        });
        return;
      }
      if (!field.required && isEmpty(value)) {
        warningCells += 1;
        return;
      }
      if (!isEmpty(value) && !matchesType(value, field)) {
        wrongTypeCells += 1;
        invalidRows.add(index);
        issues.push({
          code: "wrong_data_type",
          row: displayRow,
          column: field.key,
          message: `Row ${displayRow}: ${field.label} must be ${field.type}`,
        });
      }
    });
    if (source.id === "sales" && !isEmpty(row.employee_code) && isEmpty(row.salesperson_code) && isEmpty(row.salesperson_name)) {
      warningCells += 1;
      issues.push({ code: "unmapped_employee", row: displayRow, column: "employee_code", severity: "warning", message: `Row ${displayRow}: employee code has no canonical salesperson mapping` });
    }
  });

  const duplicateKeys = new Map<string, number>();
  rows.forEach((row, index) => {
    if (options.duplicateRule === "booking_source_rows_are_transactions") return;
    let key: string | null;
    if (options.duplicateRule === "current_stock_physical_identifier") {
      if (!isCurrentStockRow(row)) return;
      const keys = stockPhysicalIdentifierKeys({
        chassisNumber: row.chassis_number,
        engineNumber: row.engine_number,
        serialNumber: row.serial_number,
        stockId: row.stock_number,
      });
      if (!keys.length) return;
      const duplicateKey = keys.find((candidate) => duplicateKeys.has(candidate));
      const firstRow = duplicateKey ? duplicateKeys.get(duplicateKey) : undefined;
      keys.forEach((candidate) => {
        if (!duplicateKeys.has(candidate)) duplicateKeys.set(candidate, index);
      });
      if (firstRow === undefined) return;
      duplicateRows += 1;
      warningCells += 1;
      issues.push({
        code: "duplicate",
        row: options.sourceRowNumbers?.[index] ?? index + 2,
        severity: "warning",
        message: `Row ${options.sourceRowNumbers?.[index] ?? index + 2}: duplicates row ${options.sourceRowNumbers?.[firstRow] ?? firstRow + 2}`,
      });
      return;
    } else if (source.id === "sales") {
      // Prefer the pre-mapping full-source fingerprint. The real CPI workbook
      // contains separate machines whose mapped financial fields are equal but
      // whose REF_CODE/chassis/detail fields differ. Falling back to the exact
      // canonical row keeps direct validator callers and simple formats safe.
      key = options.sourceRowSignatures?.[index]
        ?? exactSalesTransactionKey(source, headers, row);
      if (!key) return;
    } else {
      const values = source.duplicateKey.map((field) => row[field]);
      if (values.some(isEmpty)) return;
      key = values.map(comparableValue).join("\u001f");
    }
    const firstRow = duplicateKeys.get(key);
    if (firstRow !== undefined) {
      duplicateRows += 1;
      const warning = options.duplicateRule === "current_stock_physical_identifier";
      if (warning) warningCells += 1;
      else invalidRows.add(index);
      issues.push({
        code: "duplicate",
        row: options.sourceRowNumbers?.[index] ?? index + 2,
        severity: warning ? "warning" : undefined,
        message: `Row ${options.sourceRowNumbers?.[index] ?? index + 2}: duplicates row ${options.sourceRowNumbers?.[firstRow] ?? firstRow + 2}`,
      });
      return;
    }
    duplicateKeys.set(key, index);
  });

  const allRowsInvalid = missingColumns.length > 0;
  const invalidRowCount = allRowsInvalid ? rows.length : invalidRows.size;

  return {
    totalRows: rows.length,
    validRows: Math.max(0, rows.length - invalidRowCount),
    invalidRows: invalidRowCount,
    duplicateRows,
    emptyCells,
    wrongTypeCells,
    warningCells,
    missingColumns,
    issues,
    canImport: rows.length > 0 && missingColumns.length === 0 && issues.every((issue) => issue.severity === "warning"),
  };
}

function isCurrentStockRow(row: ImportRow) {
  const kmm = String(row.kmm_flag ?? "").trim();
  const status = String(row.stock_status ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return kmm === "1" && status === "FREE STOCK";
}
