"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  History,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth } from "../../lib/firebase";
import {
  applyColumnMappings,
  createColumnMappings,
  loadSavedMapping,
  type ColumnMapping,
} from "../../lib/data-hub/column-mapping";
import { parseSpreadsheetFile } from "../../lib/data-hub/parse-spreadsheet";
import { getImportSourceDefinition } from "../../lib/data-hub/source-definitions";
import { completeUnifiedModuleImport } from "../../lib/data-hub/unified-import-service";
import type {
  ImportHistoryRecord,
  ImportModule,
  ParsedImportFile,
  ValidationSummary,
} from "../../lib/data-hub/types";
import { validateImportRows } from "../../lib/data-hub/validate-import";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useLocale } from "../../src/hooks/useLocale";

const importModules: Array<{ id: ImportModule; label: string }> = [
  { id: "sales", label: "Sales" },
  { id: "booking", label: "Booking" },
  { id: "stock", label: "Stock" },
];

type SmartImportState = {
  sourceFile: File | null;
  parsedFile: ParsedImportFile | null;
  mappedFile: ParsedImportFile | null;
  mappings: ColumnMapping[];
  validation: ValidationSummary | null;
  year: number | null;
  month: number | null;
  status: "idle" | "reading" | "ready" | "warning" | "blocked" | "importing" | "success";
  error: string | null;
};

const emptyImportState = (): SmartImportState => ({
  sourceFile: null,
  parsedFile: null,
  mappedFile: null,
  mappings: [],
  validation: null,
  year: null,
  month: null,
  status: "idle",
  error: null,
});

function isImportModule(value: unknown): value is ImportModule {
  return value === "sales" || value === "booking" || value === "stock";
}

function formatCell(value: unknown) {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(value);
  }
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatFileSize(size: number) {
  return size < 1_048_576
    ? `${Math.max(1, Math.round(size / 1024)).toLocaleString()} KB`
    : `${(size / 1_048_576).toFixed(1)} MB`;
}

function statusLabel(state: SmartImportState) {
  if (state.status === "reading") return "Reading file";
  if (state.status === "importing") return "Importing";
  if (state.status === "success") return "Imported";
  if (state.status === "blocked") return "Action required";
  if (state.status === "warning") return "Ready with warnings";
  if (state.status === "ready") return "Ready to import";
  return "Waiting for file";
}

function StatusMark({ state }: { state: SmartImportState }) {
  const warning = state.status === "warning" || state.status === "blocked";
  const positive = state.status === "ready" || state.status === "success";
  return (
    <span
      role="status"
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
        positive && "bg-[var(--status-success-bg)] text-[var(--status-success)]",
        warning && "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
        !positive && !warning && "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
      )}
    >
      {positive ? <CheckCircle2 size={14} aria-hidden="true" /> : warning ? <AlertTriangle size={14} aria-hidden="true" /> : <RefreshCw size={14} className={state.status === "reading" || state.status === "importing" ? "animate-spin" : ""} aria-hidden="true" />}
      {statusLabel(state)}
    </span>
  );
}

function FileTypeSelect({
  value,
  disabled,
  onChange,
}: {
  value: ImportModule | "";
  disabled: boolean;
  onChange: (value: ImportModule | "auto") => void;
}) {
  return (
    <label className="min-w-[210px] text-xs font-semibold text-[var(--text-secondary)]">
      File type
      <select
        aria-label="Confirm uploaded file type"
        value={value || "auto"}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ImportModule | "auto")}
        className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm font-medium text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--text-disabled)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="auto">Auto detect (recommended)</option>
        {importModules.map((module) => (
          <option key={module.id} value={module.id}>{module.label}</option>
        ))}
      </select>
    </label>
  );
}

function ValidationStrip({ summary, mappingWarnings }: { summary: ValidationSummary; mappingWarnings: number }) {
  const items = [
    { label: "rows", value: summary.totalRows, className: "text-[var(--text-primary)]" },
    { label: "valid", value: summary.validRows, className: "text-[var(--status-success)]" },
    { label: "warnings", value: summary.warningCells + mappingWarnings, className: "text-[var(--status-warning)]" },
    { label: "errors", value: summary.invalidRows, className: summary.invalidRows ? "text-[var(--status-danger)]" : "text-[var(--text-secondary)]" },
  ];
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-[var(--divider)] rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] sm:grid-cols-4 sm:divide-y-0" aria-label="Validation summary">
      {items.map((item) => (
        <div key={item.label} className="flex min-h-12 items-center justify-center gap-1.5 px-3 text-xs">
          <strong className={cn("kmm-tabular text-sm", item.className)}>{item.value.toLocaleString()}</strong>
          <span className="text-[var(--text-tertiary)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function PreviewTable({ file }: { file: ParsedImportFile }) {
  const headers = file.headers.slice(0, 6);
  return (
    <div className="overflow-hidden rounded-[var(--radius-control-lg)] border border-[var(--divider)]">
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="truncate border-r border-[var(--divider)] px-3 py-2.5 font-semibold last:border-r-0" title={header}>{header.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {file.rows.slice(0, 5).map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[var(--divider)] last:border-b-0">
              {headers.map((header) => (
                <td key={header} className="truncate border-r border-[var(--divider)] px-3 py-2.5 text-[var(--text-secondary)] last:border-r-0" title={formatCell(row[header])}>{formatCell(row[header])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
        Previewing 5 of {file.rows.length.toLocaleString()} rows and {headers.length} of {file.headers.length} columns.
      </p>
    </div>
  );
}

function HistoryDisclosure({ history }: { history: ImportHistoryRecord[] }) {
  return (
    <details className="group rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset sm:px-5">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><History size={17} aria-hidden="true" />Import history</span>
        <span className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">{history.length.toLocaleString()} records <ChevronDown size={15} className="transition-transform group-open:rotate-180" aria-hidden="true" /></span>
      </summary>
      <div className="border-t border-[var(--divider)] px-4 py-2 sm:px-5">
        {history.length === 0 ? (
          <p className="py-5 text-sm text-[var(--text-secondary)]">No import history is available yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--divider)]">
            {history.slice(0, 8).map((record) => (
              <li key={record.id} className="grid gap-1 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_100px_120px_180px] sm:items-center">
                <span className="truncate font-semibold text-[var(--text-primary)]" title={record.filename}>{record.filename}</span>
                <span className="capitalize text-[var(--text-secondary)]">{record.module}</span>
                <span className="kmm-tabular text-[var(--text-secondary)]">{record.success.toLocaleString()} rows</span>
                <time className="text-[var(--text-tertiary)]" dateTime={record.importedAt}>{new Date(record.importedAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export function SmartImportCenter() {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedModule, setSelectedModule] = useState<ImportModule | "">("");
  const [autoDetected, setAutoDetected] = useState(false);
  const [state, setState] = useState<SmartImportState>(emptyImportState);
  const [history, setHistory] = useState<ImportHistoryRecord[]>([]);

  const mappingWarnings = useMemo(
    () => state.mappings.filter((mapping) => mapping.status === "warning").length,
    [state.mappings],
  );
  const periodReady = Boolean(state.year && state.month && state.month >= 1 && state.month <= 12);
  const canImport = Boolean(
    selectedModule
      && state.mappedFile
      && state.validation?.canImport
      && periodReady
      && state.status !== "importing"
      && state.status !== "success",
  );

  const loadHistory = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const response = await globalThis["fetch"]("/api/data-hub/import", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json() as { history?: ImportHistoryRecord[] };
      setHistory(payload.history ?? []);
    } catch {
      // Upload and validation remain available if the optional history read fails.
    }
  };

  useEffect(() => { void loadHistory(); }, []);

  const buildValidatedState = async (file: File, module: ImportModule, parsed?: ParsedImportFile) => {
    const finalParsed = parsed && parsed.detectedModule === module
      ? parsed
      : await parseSpreadsheetFile(file, { module });
    if (finalParsed.structureError) throw new Error(finalParsed.structureError);
    const source = getImportSourceDefinition(module, "product");
    const mappings = createColumnMappings(source, finalParsed.headers, loadSavedMapping(module), finalParsed.inferredFields);
    const mappedFile = applyColumnMappings(finalParsed, mappings);
    const validation = validateImportRows(source, mappedFile.headers, mappedFile.rows, {
      quantityRule: mappedFile.quantityRule,
      duplicateRule: mappedFile.duplicateRule,
      sourceRowNumbers: mappedFile.sourceRowNumbers,
      sourceRowSignatures: mappedFile.sourceRowSignatures,
    });
    const warningTotal = validation.warningCells + mappings.filter((mapping) => mapping.status === "warning").length;
    const error = validation.canImport
      ? null
      : validation.missingColumns.length
        ? `Missing required columns: ${validation.missingColumns.join(", ")}`
        : `Resolve ${validation.invalidRows.toLocaleString()} validation error(s) before import.`;
    setState({
      sourceFile: file,
      parsedFile: finalParsed,
      mappedFile,
      mappings,
      validation,
      year: finalParsed.detection?.year.value ?? null,
      month: finalParsed.detection?.month.value ?? null,
      status: validation.canImport ? (warningTotal ? "warning" : "ready") : "blocked",
      error,
    });
  };

  const processFile = async (file: File, requestedModule?: ImportModule) => {
    setState({ ...emptyImportState(), sourceFile: file, status: "reading" });
    try {
      const detectedFile = await parseSpreadsheetFile(file, requestedModule ? { module: requestedModule } : {});
      const detectedModule = requestedModule ?? (isImportModule(detectedFile.detection?.module.value) ? detectedFile.detection.module.value : null);
      if (!detectedModule) {
        setSelectedModule("");
        setAutoDetected(false);
        setState({
          ...emptyImportState(),
          sourceFile: file,
          parsedFile: detectedFile,
          status: "blocked",
          error: "File type could not be confirmed. Select Sales, Booking or Stock to continue.",
        });
        return;
      }
      setSelectedModule(detectedModule);
      setAutoDetected(!requestedModule);
      await buildValidatedState(file, detectedModule, detectedFile);
    } catch (error) {
      setAutoDetected(false);
      setState({
        ...emptyImportState(),
        sourceFile: file,
        status: "blocked",
        error: error instanceof Error ? error.message : "Unable to read this file.",
      });
    }
  };

  const handleTypeChange = async (value: ImportModule | "auto") => {
    const file = state.sourceFile;
    if (value === "auto") {
      setSelectedModule("");
      setAutoDetected(false);
      if (file) await processFile(file);
      return;
    }
    setSelectedModule(value);
    setAutoDetected(false);
    if (file) await processFile(file, value);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void processFile(file, selectedModule || undefined);
  };

  const handleDropzoneKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const reset = () => {
    setSelectedModule("");
    setAutoDetected(false);
    setState(emptyImportState());
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadErrorReport = () => {
    const rows = state.validation?.issues.length
      ? state.validation.issues
      : [{ code: "file_error", row: "", column: "", message: state.error ?? "Unable to process this file." }];
    const csv = [
      "Issue,Row,Column,Message",
      ...rows.map((issue) => [issue.code, issue.row ?? "", issue.column ?? "", issue.message]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.sourceFile?.name.replace(/\.[^.]+$/, "") ?? "import"}-error-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async () => {
    if (!selectedModule || !state.mappedFile || !state.validation?.canImport || !state.year || !state.month) return;
    setState((current) => ({ ...current, status: "importing", error: null }));
    try {
      const record = await completeUnifiedModuleImport({
        module: selectedModule,
        file: state.mappedFile,
        validation: state.validation,
        year: state.year,
        month: state.month,
        businessWeek: state.mappedFile.detection?.businessWeek.value ?? null,
        emitRefresh: true,
      });
      setHistory((current) => [record, ...current]);
      setState((current) => ({ ...current, status: "success" }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "blocked",
        error: error instanceof Error ? error.message : "Import failed.",
      }));
    }
  };

  const selectedLabel = importModules.find((module) => module.id === selectedModule)?.label;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1480px] p-4 sm:p-5 xl:p-6">
        <div className="space-y-5">
          <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-600)]">Data Hub · KMM</p>
              <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight sm:text-[30px]">{t("dataHub.smartImport")}</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("dataHub.smartImportDescription")}</p>
            </div>
            <a href="#import-history" className="inline-flex min-h-11 items-center gap-2 self-start rounded-[var(--radius-control)] px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:self-auto">
              <History size={16} aria-hidden="true" />{t("dataHub.history")}
            </a>
          </header>

          <Card className="overflow-hidden p-0">
            <div className="grid gap-4 border-b border-[var(--divider)] px-4 py-4 sm:grid-cols-[minmax(0,1fr)_230px] sm:items-end sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("dataHub.upload")}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{t("dataHub.uploadDescription")}</p>
              </div>
              <FileTypeSelect value={selectedModule} disabled={state.status === "reading" || state.status === "importing"} onChange={(value) => void handleTypeChange(value)} />
            </div>

            <div className="p-4 sm:p-5">
              {!state.sourceFile ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload spreadsheet"
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={handleDropzoneKey}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  className="grid min-h-[270px] cursor-pointer place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--text-disabled)] bg-[var(--surface-subtle)] px-6 py-10 text-center transition-colors hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <div>
                    <span className="mx-auto grid size-14 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--surface-default)] text-[var(--brand-600)] shadow-[var(--shadow-card)]"><UploadCloud size={25} aria-hidden="true" /></span>
                    <h3 className="mt-4 text-lg font-semibold">{t("dataHub.drop")}</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Sales, Booking or Stock · XLSX, XLS or CSV · Maximum 20 MB</p>
                    <Button type="button" variant="outline" className="mt-5 pointer-events-none">{t("dataHub.browse")}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4" aria-busy={state.status === "reading" || state.status === "importing"}>
                  <div className="flex flex-col gap-3 rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--status-success-bg)] text-[var(--status-success)]"><FileSpreadsheet size={20} aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" title={state.sourceFile.name}>{state.sourceFile.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{formatFileSize(state.sourceFile.size)}{state.parsedFile ? ` · ${state.parsedFile.rows.length.toLocaleString()} rows` : ""}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {autoDetected && selectedLabel && <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-2.5 text-xs font-semibold text-[var(--brand-700)]"><ShieldCheck size={13} aria-hidden="true" />Auto-detected: {selectedLabel}</span>}
                      <StatusMark state={state} />
                      <button type="button" aria-label="Remove uploaded file" onClick={reset} disabled={state.status === "importing"} className="grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"><X size={17} aria-hidden="true" /></button>
                    </div>
                  </div>

                  {state.error && (
                    <div className="flex items-start justify-between gap-3 rounded-[var(--radius-control-lg)] border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]" role="alert">
                      <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />{state.error}</span>
                      {state.validation && <button type="button" onClick={downloadErrorReport} className="inline-flex min-h-8 shrink-0 items-center gap-1 font-semibold underline underline-offset-4"><Download size={14} aria-hidden="true" />Report</button>}
                    </div>
                  )}

                  {state.validation && <ValidationStrip summary={state.validation} mappingWarnings={mappingWarnings} />}

                  {state.mappedFile && <PreviewTable file={state.mappedFile} />}

                  {state.validation && state.validation.issues.length > 0 && (
                    <details className="group rounded-[var(--radius-control-lg)] border border-[var(--divider)]">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">
                        <span>Review {state.validation.issues.length.toLocaleString()} data issue(s)</span>
                        <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <ul className="max-h-40 divide-y divide-[var(--divider)] overflow-auto border-t border-[var(--divider)] text-xs">
                        {state.validation.issues.slice(0, 50).map((issue, index) => (
                          <li key={`${issue.code}-${issue.row ?? "workbook"}-${index}`} className="px-3 py-2 text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{issue.row ? `Row ${issue.row}` : "Workbook"}{issue.column ? ` · ${issue.column}` : ""}:</strong> {issue.message}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {selectedModule && state.parsedFile && !periodReady && (
                    <div className="grid gap-2 rounded-[var(--radius-control-lg)] border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] p-3 sm:grid-cols-[minmax(0,1fr)_140px_180px] sm:items-end">
                      <div><p className="text-sm font-semibold">Confirm reporting period</p><p className="mt-1 text-xs text-[var(--text-secondary)]">The file type is confirmed, but its year or month could not be detected.</p></div>
                      <label className="text-xs font-semibold">Year<input aria-label="Import year" inputMode="numeric" value={state.year ?? ""} onChange={(event) => setState((current) => ({ ...current, year: Number(event.target.value) || null }))} className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-white px-3 text-sm" /></label>
                      <label className="text-xs font-semibold">Month<select aria-label="Import month" value={state.month ?? ""} onChange={(event) => setState((current) => ({ ...current, month: Number(event.target.value) || null }))} className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-white px-3 text-sm"><option value="">Select month</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2020, month - 1, 1))}</option>)}</select></label>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-[var(--divider)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[var(--text-tertiary)]">{selectedLabel && state.year && state.month ? `${selectedLabel} · ${new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2020, state.month - 1, 1))} ${state.year}` : "Confirm the detected file type and period before import."}</p>
                    {state.status === "success" ? (
                      <Button type="button" variant="outline" onClick={reset}>Import another file <ArrowRight size={15} aria-hidden="true" /></Button>
                    ) : (
                      <Button type="button" disabled={!canImport} onClick={() => void importFile()}>{state.status === "importing" ? <RefreshCw className="animate-spin" size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}Approve &amp; import {selectedLabel ?? "data"}</Button>
                    )}
                  </div>
                </div>
              )}
              <input ref={inputRef} type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file, selectedModule || undefined); }} />
            </div>
          </Card>

          <div id="import-history"><HistoryDisclosure history={history} /></div>
        </div>
      </main>
    </div>
  );
}
