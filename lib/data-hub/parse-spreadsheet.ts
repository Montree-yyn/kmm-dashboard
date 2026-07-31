import * as XLSX from "@e965/xlsx";
import type { ImportRow, ParsedImportFile } from "./types";

const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_ROWS = 50_000;

export function normalizeColumnName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function parseSpreadsheetFile(
  file: File,
): Promise<ParsedImportFile> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Choose an XLSX, XLS or CSV file.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("The selected file exceeds the 20 MB upload limit.");
  }

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  const rawHeaders = matrix[0] ?? [];
  const headers = rawHeaders.map(normalizeColumnName);

  if (!headers.some(Boolean)) {
    throw new Error("The first worksheet does not contain a header row.");
  }
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) {
    throw new Error("The file contains duplicate column names.");
  }

  const rows: ImportRow[] = matrix
    .slice(1)
    .filter((row) => row.some((value) => value !== null && value !== ""))
    .map((row) =>
      Object.fromEntries(
        headers
          .map((header, index) => [header, row[index] ?? null] as const)
          .filter(([header]) => Boolean(header)),
      ),
    );

  if (rows.length > MAX_ROWS) {
    throw new Error(
      `This file contains ${rows.length.toLocaleString()} rows. The Phase 1 limit is ${MAX_ROWS.toLocaleString()} rows per import.`,
    );
  }

  return {
    filename: file.name,
    extension: extension as ParsedImportFile["extension"],
    headers: headers.filter(Boolean),
    rows,
    sheetName,
  };
}
