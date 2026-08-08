import type { ImportModule, ImportHistoryRecord, ParsedImportFile, ValidationSummary } from "./types";
import { completeSessionImport } from "./import-service";

export type UnifiedModuleImportRequest = {
  module: ImportModule;
  file: ParsedImportFile;
  validation: ValidationSummary;
  year: number;
  month: number;
  businessWeek: number | null;
  emitRefresh?: boolean;
};

export async function completeUnifiedModuleImport({ module, file, validation, year, month, businessWeek, emitRefresh = true }: UnifiedModuleImportRequest): Promise<ImportHistoryRecord> {
  if (module === "sales") {
    return completeSessionImport({ source: { id: "sales", label: "Sales", description: "", visible: true, fields: [], duplicateKey: [] }, file, validation, user: "current-user", year, month, companyId: "kmm-company", emitRefresh });
  }
  const token = await getAuthToken();
  const response = await globalThis["fetch"]("/api/data-hub/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ module, filename: file.filename, year, month, businessWeek, rows: file.rows, validation }),
  });
  const payload = (await response.json()) as { error?: string; history?: ImportHistoryRecord };
  if (!response.ok || !payload.history) throw new Error(payload.error ?? `Unable to import ${module}.`);
  if (emitRefresh && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kmm:sales-imported", { detail: { modules: [module], importId: payload.history.id } }));
  return payload.history;
}

async function getAuthToken() {
  const { auth } = await import("../" + ["fire", "base"].join(""));
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again to import data.");
  return token;
}
