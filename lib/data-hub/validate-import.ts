import type {
  DataFieldDefinition,
  DataSourceDefinition,
  ImportRow,
  ValidationIssue,
  ValidationSummary,
} from "./types";

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

export function validateImportRows(
  source: DataSourceDefinition,
  headers: string[],
  rows: ImportRow[],
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
  const invalidRows = new Set<number>();
  let emptyCells = 0;
  let wrongTypeCells = 0;
  let duplicateRows = 0;
  let warningCells = 0;

  rows.forEach((row, index) => {
    const displayRow = index + 2;
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
  });

  const duplicateKeys = new Map<string, number>();
  rows.forEach((row, index) => {
    const values = source.duplicateKey.map((key) => row[key]);
    if (values.some(isEmpty)) return;
    const key = values.map(comparableValue).join("\u001f");
    const firstRow = duplicateKeys.get(key);
    if (firstRow !== undefined) {
      duplicateRows += 1;
      invalidRows.add(index);
      issues.push({
        code: "duplicate",
        row: index + 2,
        message: `Row ${index + 2}: duplicates row ${firstRow + 2}`,
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
    canImport: rows.length > 0 && missingColumns.length === 0 && issues.length === 0,
  };
}
