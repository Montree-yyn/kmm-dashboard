import type {
  DataSourceDefinition,
  ImportHistoryRecord,
  ParsedImportFile,
  ValidationSummary,
} from "./types";
import { resolveActiveCompanyId } from "../company-context/client-store";
import { APPROVED_SALES_INCREMENTAL_GUARD, type ApprovedSalesIncrementalGuard, type SalesIncrementalPreview } from "./sales-incremental";

export type SalesImportMode = "replace" | "append";

export type ImportRequest = {
  source: DataSourceDefinition;
  file: ParsedImportFile;
  validation: ValidationSummary;
  user: string;
  year?: number;
  month?: number;
  companyId?: string;
  emitRefresh?: boolean;
  mode?: SalesImportMode;
  appendGuard?: ApprovedSalesIncrementalGuard;
};

export type SalesIncrementalPreviewRequest = Pick<ImportRequest, "file" | "validation" | "year" | "month" | "companyId">;

export type ImportFailureRequest = {
  source: DataSourceDefinition;
  filename: string;
  user: string;
  reason: string;
  validation?: ValidationSummary | null;
};

// This boundary becomes the Data Hub API client.
export async function completeSessionImport({
  file,
  validation,
  year,
  month,
  companyId,
  emitRefresh = true,
  mode = "replace",
  appendGuard,
}: ImportRequest): Promise<ImportHistoryRecord> {
  const startedAt = performance.now();
  if (!validation.canImport) {
    throw new Error("Resolve validation issues before importing this file.");
  }

  const token = await getAuthToken();
  const response = await globalThis["fetch"]("/api/data-hub/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: mode === "append" ? "append" : "replace",
      mode,
      companyId: resolveActiveCompanyId(companyId),
      year: year ?? new Date(String(file.rows[0]?.sale_date)).getFullYear(),
      month: month ?? new Date(String(file.rows[0]?.sale_date)).getMonth() + 1,
      filename: file.filename,
      rows: file.rows,
      validation,
      ...(mode === "append" ? { guard: appendGuard ?? APPROVED_SALES_INCREMENTAL_GUARD } : {}),
    }),
  });
  const payload = (await response.json()) as { error?: string; history?: ImportHistoryRecord };
  if (!response.ok || !payload.history) throw new Error(payload.error ?? "Unable to complete this import.");
  if (emitRefresh && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kmm:sales-imported", { detail: { importId: payload.history.id } }));
  return { ...payload.history, durationMs: Math.max(payload.history.durationMs, Math.round(performance.now() - startedAt)) };
}

export async function previewSessionSalesImport({ file, validation, year, month, companyId }: SalesIncrementalPreviewRequest): Promise<SalesIncrementalPreview> {
  if (!validation.canImport) throw new Error("Resolve validation issues before previewing this incremental import.");
  const token = await getAuthToken();
  const response = await globalThis["fetch"]("/api/data-hub/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: "preview",
      mode: "append",
      companyId: resolveActiveCompanyId(companyId),
      year: year ?? new Date(String(file.rows[0]?.sale_date)).getFullYear(),
      month: month ?? new Date(String(file.rows[0]?.sale_date)).getMonth() + 1,
      filename: file.filename,
      rows: file.rows,
      validation,
      guard: APPROVED_SALES_INCREMENTAL_GUARD,
    }),
  });
  const payload = await response.json() as { error?: string; preview?: SalesIncrementalPreview };
  if (!response.ok || !payload.preview) throw new Error(payload.error ?? "Unable to preview this incremental import.");
  return payload.preview;
}

export async function persistSalesMapping(mapping: Record<string, string | null>, companyId?: string) {
  const token = await getAuthToken();
  const response = await globalThis["fetch"]("/api/data-hub/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: "save_mapping",
      companyId: resolveActiveCompanyId(companyId),
      mapping,
    }),
  });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Unable to save this mapping.");
}

async function getAuthToken() {
  const { auth } = await import("../" + ["fire", "base"].join(""));
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again to import data.");
  return token;
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
