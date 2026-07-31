import type {
  DataSourceDefinition,
  ImportHistoryRecord,
  ParsedImportFile,
  ValidationSummary,
} from "./types";

export type ImportRequest = {
  source: DataSourceDefinition;
  file: ParsedImportFile;
  validation: ValidationSummary;
  user: string;
};

export type ImportFailureRequest = {
  source: DataSourceDefinition;
  filename: string;
  user: string;
  reason: string;
  validation?: ValidationSummary | null;
};

// This boundary becomes the Data Hub API client when persistence is enabled.
export async function completeSessionImport({
  source,
  file,
  validation,
  user,
}: ImportRequest): Promise<ImportHistoryRecord> {
  const startedAt = performance.now();
  if (!validation.canImport) {
    throw new Error("Resolve validation issues before importing this file.");
  }

  return {
    id: crypto.randomUUID(),
    filename: file.filename,
    module: source.label,
    importedAt: new Date().toISOString(),
    importedBy: user,
    rows: validation.totalRows,
    success: validation.validRows,
    warning: validation.warningCells,
    error: validation.invalidRows,
    status: "success",
    durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
    rollbackAvailable: false,
  };
}

export function recordSessionImportFailure({
  source,
  filename,
  user,
  reason,
  validation,
}: ImportFailureRequest): ImportHistoryRecord {
  return {
    id: crypto.randomUUID(),
    filename,
    module: source.label,
    importedAt: new Date().toISOString(),
    importedBy: user,
    rows: validation?.totalRows ?? 0,
    success: validation?.validRows ?? 0,
    warning: validation?.warningCells ?? 0,
    error: validation?.invalidRows ?? 1,
    status: "failed",
    failureReason: reason,
    durationMs: 0,
    rollbackAvailable: false,
  };
}
