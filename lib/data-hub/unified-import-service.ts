import type { ImportModule, ImportHistoryRecord, ParsedImportFile, ValidationSummary } from "./types";
import { completeSessionImport, type SalesImportMode } from "./import-service";
import type { ApprovedSalesIncrementalGuard } from "./sales-incremental";
import { resolveActiveCompanyId } from "../company-context/client-store";
import { getSessionAuthToken } from "./session-auth";

export type UnifiedModuleImportRequest = {
  module: ImportModule;
  file: ParsedImportFile;
  validation: ValidationSummary;
  year: number;
  month: number;
  businessWeek: number | null;
  companyId?: string;
  emitRefresh?: boolean;
  mode?: SalesImportMode;
  appendGuard?: ApprovedSalesIncrementalGuard;
};

export async function completeUnifiedModuleImport({ module, file, validation, year, month, businessWeek, companyId, emitRefresh = true, mode = "replace", appendGuard }: UnifiedModuleImportRequest): Promise<ImportHistoryRecord> {
  if (module === "sales") {
    return completeSessionImport({ source: { id: "sales", label: "Sales", description: "", visible: true, fields: [], duplicateKey: [] }, file, validation, user: "current-user", year, month, companyId, emitRefresh, mode, appendGuard });
  }
  const token = await getAuthToken();
  const response = await globalThis["fetch"]("/api/data-hub/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ companyId: resolveActiveCompanyId(companyId), module, filename: file.filename, year, month, businessWeek, rows: file.rows, validation }),
  });
  const payload = (await response.json()) as { error?: string; history?: ImportHistoryRecord };
  if (!response.ok || !payload.history) throw new Error(payload.error ?? `Unable to import ${module}.`);
  if (emitRefresh && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kmm:sales-imported", { detail: { modules: [module], importId: payload.history.id } }));
  return payload.history;
}

async function getAuthToken() {
  return getSessionAuthToken();
}
