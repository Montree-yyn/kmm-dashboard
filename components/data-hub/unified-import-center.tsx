"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FileSpreadsheet,
  FileWarning,
  History,
  PackageSearch,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { auth } from "../../lib/firebase";
import { completeUnifiedModuleImport } from "../../lib/data-hub/unified-import-service";
import { applyColumnMappings, createColumnMappings, loadSavedMapping, type ColumnMapping } from "../../lib/data-hub/column-mapping";
import { parseSpreadsheetFile, type SpreadsheetParseOptions } from "../../lib/data-hub/parse-spreadsheet";
import { getImportSourceDefinition } from "../../lib/data-hub/source-definitions";
import type { ImportHistoryRecord, ImportModule, ImportStatus, ParsedImportFile, ValidationSummary } from "../../lib/data-hub/types";
import { validateImportRows } from "../../lib/data-hub/validate-import";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type ModuleUiStatus = ImportStatus | "valid";
type StatusTone = "positive" | "negative" | "warning" | "neutral";

type ModuleState = {
  sourceFile: File | null;
  file: ParsedImportFile | null;
  mappedFile: ParsedImportFile | null;
  validation: ValidationSummary | null;
  mappings: ColumnMapping[];
  year: number | null;
  month: number | null;
  status: ModuleUiStatus;
  error: string | null;
};

const modules: Array<{ id: ImportModule; label: string; icon: typeof Banknote }> = [
  { id: "sales", label: "Sales", icon: Banknote },
  { id: "booking", label: "Booking", icon: CalendarCheck2 },
  { id: "stock", label: "Stock", icon: PackageSearch },
];

const workflowSteps = ["Upload", "Preview", "Validation", "Approval", "Import", "Dashboard Update", "Completed"] as const;
const emptyState = (): ModuleState => ({ sourceFile: null, file: null, mappedFile: null, validation: null, mappings: [], year: null, month: null, status: "ready", error: null });

function normalizeModule(value: string) {
  return value.trim().toLowerCase() as ImportModule;
}

function latestHistoryFor(history: ImportHistoryRecord[], module: ImportModule) {
  return history.find((record) => normalizeModule(record.module) === module);
}

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function warningCount(state: ModuleState) {
  return state.validation?.warningCells ?? 0;
}

function errorCount(state: ModuleState) {
  return state.validation?.invalidRows ?? (state.error && !state.validation ? 1 : 0);
}

function mappingWarningCount(state: ModuleState) {
  return state.mappings.filter((mapping) => mapping.status === "warning").length;
}

function currentWorkflowStep(state: ModuleState) {
  if (state.status === "success") return workflowSteps.length - 1;
  if (state.status === "importing") return 4;
  if (state.validation && !state.validation.canImport) return 2;
  if (state.validation?.canImport) return 3;
  if (state.file) return 1;
  return 0;
}

function moduleStatusLabel(state: ModuleState) {
  if (state.status === "uploading") return "Uploading";
  if (state.status === "importing") return "Importing";
  if (state.status === "success") return "Success";
  if (state.status === "failed") return state.validation?.canImport ? "Failed" : "Blocked";
  if (state.validation?.canImport && (warningCount(state) > 0 || mappingWarningCount(state) > 0)) return "Warning";
  if (state.validation?.canImport) return "Ready";
  if (state.file) return "Preview";
  return "Ready";
}

function statusTone(label: string): StatusTone {
  if (label === "Success" || label === "Ready") return "positive";
  if (label === "Failed" || label === "Blocked") return "negative";
  if (label === "Warning" || label === "Uploading" || label === "Importing") return "warning";
  return "neutral";
}

function StatePill({ label, tone = statusTone(label) }: { label: string; tone?: StatusTone }) {
  const classes: Record<StatusTone, string> = {
    positive: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
    negative: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
    warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
    neutral: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  };
  return <span role="status" className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes[tone]}`}>{label}</span>;
}

function preflightFor(state: ModuleState) {
  if (!state.sourceFile) return { label: "Missing", tone: "neutral" as StatusTone, detail: "Select a file to begin." };
  if (state.status === "uploading") return { label: "Blocked", tone: "negative" as StatusTone, detail: "File is still being read." };
  if (!state.file || !state.mappedFile || !state.validation) return { label: "Blocked", tone: "negative" as StatusTone, detail: "Preview and validation are required." };
  if (!state.validation.canImport) return { label: "Blocked", tone: "negative" as StatusTone, detail: "Resolve validation errors before importing." };
  if (!state.year || !state.month || state.month < 1 || state.month > 12) return { label: "Blocked", tone: "negative" as StatusTone, detail: "Confirm the detected import period." };
  if (state.status === "failed") return { label: "Warning", tone: "warning" as StatusTone, detail: "Previous attempt failed; retry is available." };
  if (warningCount(state) > 0 || mappingWarningCount(state) > 0) return { label: "Warning", tone: "warning" as StatusTone, detail: "Ready with warnings to review." };
  return { label: "Ready", tone: "positive" as StatusTone, detail: "Ready to import." };
}

function WorkflowStepper({ label, state }: { label: string; state: ModuleState }) {
  const current = currentWorkflowStep(state);
  const currentLabel = state.status === "failed" ? `${workflowSteps[current]} blocked` : workflowSteps[current];
  return (
    <div className="space-y-2" aria-label={`${label} import workflow`}>
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-[680px] items-start" aria-label={`${label} workflow steps`}>
          {workflowSteps.map((step, index) => {
            const complete = state.status === "success" || index < current;
            const active = state.status !== "success" && index === current;
            const markerClass = state.status === "failed" && active
              ? "border-[var(--status-danger)] bg-[var(--status-danger-bg)] text-[var(--status-danger)]"
              : complete
                ? "border-[var(--status-success)] bg-[var(--status-success-bg)] text-[var(--status-success)]"
                : active
                  ? "border-[var(--brand-600)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : "border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-tertiary)]";
            return (
              <Fragment key={step}>
                <li className="flex min-w-[84px] flex-1 flex-col items-center gap-1 text-center" aria-current={active ? "step" : undefined}>
                  <span className={`grid size-7 place-items-center rounded-full border text-[11px] font-bold ${markerClass}`}>
                    {complete ? <Check size={14} aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={`text-[10px] font-semibold leading-tight ${active ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}>{step}</span>
                </li>
                {index < workflowSteps.length - 1 && <li className={`mt-3 h-px min-w-5 flex-1 ${index < current || state.status === "success" ? "bg-[var(--status-success)]" : "bg-[var(--divider)]"}`} aria-hidden="true" />}
              </Fragment>
            );
          })}
        </ol>
      </div>
      <p className="text-xs text-[var(--text-secondary)]" aria-live="polite">Current step: <span className="font-semibold text-[var(--text-primary)]">{currentLabel}</span></p>
    </div>
  );
}

function MappingReview({ mappings }: { mappings: ColumnMapping[] }) {
  if (!mappings.length) return null;
  const mapped = mappings.filter((mapping) => mapping.excelColumn !== "—" && mapping.fieldKey).length;
  const ignored = mappings.filter((mapping) => mapping.excelColumn !== "—" && !mapping.fieldKey).length;
  const missing = mappings.filter((mapping) => mapping.status === "missing").length;
  const warnings = mappings.filter((mapping) => mapping.status === "warning").length;
  const statusClass = { mapped: "text-[var(--status-success)]", warning: "text-[var(--status-warning)]", missing: "text-[var(--status-danger)]", ignored: "text-[var(--text-secondary)]" };
  return (
    <details className="group rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">
        <span>Mapping review</span>
        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] font-semibold">
          <span className="text-[var(--status-success)]">Mapped {mapped}</span>
          <span className="text-[var(--text-secondary)]">Ignored {ignored}</span>
          <span className="text-[var(--status-danger)]">Missing {missing}</span>
          {warnings > 0 && <span className="text-[var(--status-warning)]">Warnings {warnings}</span>}
          <ChevronDown size={14} aria-hidden="true" className="group-open:hidden" />
          <ChevronUp size={14} aria-hidden="true" className="hidden group-open:block" />
        </span>
      </summary>
      <div className="border-t border-[var(--divider)] p-3">
        <p className="mb-2 text-[11px] text-[var(--text-secondary)]">Automatic mapping is unchanged. Review the detected source-to-canonical fields before importing.</p>
        <div className="max-h-48 overflow-auto rounded-[var(--radius-control)] border border-[var(--divider)] bg-[var(--surface-default)]">
          <ul className="divide-y divide-[var(--divider)] text-xs">
            {mappings.map((mapping, index) => (
              <li key={`${mapping.excelColumn}-${mapping.fieldKey ?? "none"}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2">
                <span className="truncate text-[var(--text-secondary)]" title={mapping.excelColumn}>{mapping.excelColumn === "—" ? "No source column" : mapping.excelColumn}</span>
                <ArrowRight size={12} className="text-[var(--text-tertiary)]" aria-hidden="true" />
                <span className={`truncate font-semibold ${statusClass[mapping.status]}`} title={mapping.fieldKey ?? "Ignored"}>{mapping.fieldKey ?? "Ignored"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

function ValidationSummaryPanel({ summary, onDownloadErrors }: { summary: ValidationSummary; onDownloadErrors: () => void }) {
  const hasErrors = summary.invalidRows > 0 || summary.missingColumns.length > 0;
  const issuePreview = summary.issues.slice(0, 4);
  return (
    <section className="space-y-3 rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] p-3" role={hasErrors ? "alert" : "status"} aria-live={hasErrors ? "assertive" : "polite"} aria-label="Validation summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Validation</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{summary.canImport ? "Ready for approval" : "Action required before approval"}</p>
        </div>
        {hasErrors && <Button type="button" variant="outline" size="sm" onClick={onDownloadErrors}><FileWarning size={14} aria-hidden="true" />Download errors</Button>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Valid" value={summary.validRows} tone="positive" />
        <Metric label="Warnings" value={summary.warningCells} tone="warning" />
        <Metric label="Errors" value={summary.invalidRows} tone={summary.invalidRows ? "negative" : "neutral"} />
        <Metric label="Duplicates" value={summary.duplicateRows} tone={summary.duplicateRows ? "negative" : "neutral"} />
      </div>
      {summary.missingColumns.length > 0 && <p className="text-xs font-semibold text-[var(--status-danger)]">Missing required columns: {summary.missingColumns.join(", ")}</p>}
      {issuePreview.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Reviewable issues</p>
          <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
            {issuePreview.map((issue, index) => <li key={`${issue.code}-${issue.row ?? "row"}-${index}`} className={issue.severity === "warning" ? "text-[var(--status-warning)]" : "text-[var(--status-danger)]"}><span className="font-semibold">{issue.row ? `Row ${issue.row}` : "Workbook"}{issue.column ? ` · ${issue.column}` : ""}:</span> {issue.message}</li>)}
          </ul>
          {summary.issues.length > issuePreview.length && <p className="text-[11px] text-[var(--text-tertiary)]">Showing {issuePreview.length} of {summary.issues.length} issues. Download the report for the full list.</p>}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: StatusTone }) {
  const valueClass = { positive: "text-[var(--status-success)]", negative: "text-[var(--status-danger)]", warning: "text-[var(--status-warning)]", neutral: "text-[var(--text-primary)]" }[tone];
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;
  return <div className="rounded-[var(--radius-control)] border border-[var(--divider)] bg-[var(--surface-default)] px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{label}</p><p title={displayValue} className={`kmm-tabular mt-1 truncate text-sm font-semibold ${valueClass}`}>{displayValue}</p></div>;
}

function ImportCard({ label, module, icon: Icon, state, latestRecord, onFile, onStructureChange, onPeriodChange, onImport }: { label: string; module: ImportModule; icon: typeof Banknote; state: ModuleState; latestRecord?: ImportHistoryRecord; onFile: (file: File) => void; onStructureChange: (sheetName: string, headerRow?: number) => void; onPeriodChange: (year: number | null, month: number | null) => void; onImport: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [manualHeaderRow, setManualHeaderRow] = useState("");
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };
  const detection = state.file?.detection;
  const uploadHelpId = `${label.toLowerCase()}-upload-help`;
  const statusLabel = moduleStatusLabel(state);
  const downloadErrors = () => {
    const rows = state.validation
      ? state.validation.issues
      : [{ code: "file_error", row: "", column: "", message: state.error ?? "Unable to process this file." }];
    const csv = ["Issue,Row,Column,Message", ...rows.map((issue) => [issue.code, issue.row ?? "", issue.column ?? "", issue.message].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${state.file?.filename.replace(/\.[^.]+$/, "") ?? label.toLowerCase()}-error-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const candidateSheets = detection?.candidateSheets ?? [];
  return (
    <Card className="space-y-4 p-4" aria-labelledby={`${module}-import-title`} aria-busy={state.status === "uploading" || state.status === "importing"}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2"><Icon size={18} className="shrink-0 text-[var(--brand-700)]" aria-hidden="true" /><div className="min-w-0"><h2 id={`${module}-import-title`} className="truncate font-semibold text-[var(--text-primary)]">{label} Import</h2><p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Current step: {workflowSteps[currentWorkflowStep(state)]}</p></div></div>
        <StatePill label={statusLabel} />
      </div>

      <WorkflowStepper label={label} state={state} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="File" value={state.sourceFile?.name ?? "Not selected"} />
        <Metric label="Sheet" value={state.file?.sheetName ?? "—"} />
        <Metric label="Header" value={state.file?.headerRow ? `Row ${state.file.headerRow}` : "—"} />
        <Metric label="Columns" value={state.file?.detectedColumns ?? "—"} />
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label} file`}
        aria-describedby={uploadHelpId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            input.current?.click();
          }
        }}
        className="cursor-pointer rounded-[var(--radius-control)] border border-dashed border-[var(--border-default)] p-5 text-center transition-[border-color,background-color,box-shadow] duration-200 hover:border-[var(--brand-400)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        <UploadCloud className="mx-auto text-[var(--brand-700)]" size={22} aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{state.sourceFile ? "Replace file" : "Drag & Drop"}</p>
        <p id={uploadHelpId} className="mt-1 text-xs text-[var(--text-secondary)]">or Browse File · Excel / CSV</p>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label={`Select ${label} file`} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }} />
      </div>

      {state.file && <div className="space-y-2 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2"><FileSpreadsheet size={14} aria-hidden="true" /><span className="truncate">{state.file.filename}</span><span aria-hidden="true">·</span><span className="whitespace-nowrap">{state.file.rows.length.toLocaleString()} source rows</span></div>
        <p>Detected sheet: <span className="font-semibold text-[var(--text-primary)]">{state.file.sheetName}</span> · Header: <span className="font-semibold text-[var(--text-primary)]">{state.file.headerRow ? `Row ${state.file.headerRow}` : "Not detected"}</span> · Columns: <span className="font-semibold text-[var(--text-primary)]">{state.file.detectedColumns}</span></p>
        {candidateSheets.length > 1 && <label className="block">Data sheet<select aria-label={`${label} data sheet`} className="ml-2 min-h-11 rounded border border-[var(--border-default)] bg-[var(--surface-default)] px-2 py-1 text-[var(--text-primary)]" value={state.file.sheetName} onChange={(event) => onStructureChange(event.target.value)}>{candidateSheets.map((sheet) => <option key={sheet}>{sheet}</option>)}</select></label>}
        <p>Detected period: {detection?.year.value ?? "Year?"} / {detection?.month.value ?? "Month?"}{detection?.businessWeek.value ? ` / Week ${detection.businessWeek.value}` : ""} · Company KMM</p>
        {(!detection?.year.value || !detection?.month.value) && <div className="flex flex-wrap gap-2"><label>Year<input aria-label={`${label} import year`} className="ml-1 min-h-11 w-20 rounded border border-[var(--border-default)] px-1 py-0.5 text-[var(--text-primary)]" type="number" value={state.year ?? ""} onChange={(event) => onPeriodChange(Number(event.target.value) || null, state.month)} /></label><label>Month<input aria-label={`${label} import month`} className="ml-1 min-h-11 w-16 rounded border border-[var(--border-default)] px-1 py-0.5 text-[var(--text-primary)]" type="number" min="1" max="12" value={state.month ?? ""} onChange={(event) => onPeriodChange(state.year, Number(event.target.value) || null)} /></label></div>}
        {state.file.quantityRule && <p>Quantity rule: 1 per verified {state.file.quantityRule === "one_per_verified_stock_record" ? "Stock inventory" : "Sales transaction"} row.</p>}
      </div>}

      {state.file && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Valid" value={state.validation?.validRows ?? "—"} tone="positive" /><Metric label="Warnings" value={warningCount(state)} tone="warning" /><Metric label="Errors" value={errorCount(state)} tone={errorCount(state) ? "negative" : "neutral"} /><Metric label="Duplicates" value={state.validation?.duplicateRows ?? "—"} tone={state.validation?.duplicateRows ? "negative" : "neutral"} /></div>}

      {state.mappings.length > 0 && <MappingReview mappings={state.mappings} />}
      {state.error && <div role="alert" aria-live="assertive" className="space-y-2 rounded-[var(--radius-control-lg)] bg-[var(--status-danger-bg)] px-3 py-3"><div className="flex items-start gap-2 text-xs font-semibold text-[var(--status-danger)]"><CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><p>{state.error}</p></div>{state.error.includes("Header row could not be detected") && state.file && <div className="flex flex-wrap items-end gap-2 text-xs text-[var(--text-secondary)]"><label>Worksheet<select aria-label={`${label} worksheet`} className="ml-1 min-h-11 rounded border border-[var(--border-default)] bg-[var(--surface-default)] px-2 py-1 text-[var(--text-primary)]" value={state.file.sheetName} onChange={(event) => onStructureChange(event.target.value, Number(manualHeaderRow) || undefined)}>{state.file.workbookSheetNames?.map((sheet) => <option key={sheet}>{sheet}</option>)}</select></label><label>Header row<input aria-label={`${label} header row`} className="ml-1 min-h-11 w-16 rounded border border-[var(--border-default)] px-2 py-1 text-[var(--text-primary)]" type="number" min="1" value={manualHeaderRow} onChange={(event) => setManualHeaderRow(event.target.value)} /></label><Button type="button" variant="outline" disabled={!Number(manualHeaderRow)} onClick={() => onStructureChange(state.file?.sheetName ?? "", Number(manualHeaderRow))}>Apply header</Button></div>}</div>}
      {state.validation && <ValidationSummaryPanel summary={state.validation} onDownloadErrors={downloadErrors} />}
      {previewOpen && state.mappedFile && <div className="max-h-80 overflow-auto rounded border border-[var(--divider)]" aria-label={`${label} preview`}><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="sticky top-0 bg-[var(--surface-subtle)]"><th className="px-2 py-1">Row</th>{state.mappedFile.headers.map((header) => <th key={header} className="whitespace-nowrap px-2 py-1">{header}</th>)}</tr></thead><tbody>{state.mappedFile.rows.slice(0, 50).map((row, index) => <tr key={index} className="border-t border-[var(--divider)]"><td className="px-2 py-1">{state.file?.sourceRowNumbers?.[index] ?? index + 2}</td>{state.mappedFile?.headers.map((header) => <td key={header} className="whitespace-nowrap px-2 py-1">{String(row[header] ?? "")}</td>)}</tr>)}</tbody></table></div>}
      {latestRecord && latestRecord.status === "success" && state.status !== "success" && <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><CheckCircle2 size={14} className="text-[var(--status-success)]" aria-hidden="true" />Last persisted result: <span className="font-semibold text-[var(--text-primary)]">{latestRecord.success.toLocaleString()} rows</span> from {latestRecord.filename}.</p>}
      {state.status === "success" && latestRecord && <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-[var(--radius-control-lg)] bg-[var(--status-success-bg)] px-3 py-3 text-xs text-[var(--status-success)]"><CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><p><span className="font-semibold">Completed.</span> {latestRecord.success.toLocaleString()} rows persisted. Dashboard update event sent.</p></div>}

      <div className="flex flex-col gap-3 border-t border-[var(--divider)] pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-[11px] leading-5 text-[var(--text-tertiary)]">Approval is represented by the existing Import action after validation. Existing import eligibility and replace behavior are unchanged.</p><div className="flex flex-wrap justify-end gap-2">{(state.error || state.validation?.invalidRows) && <Button type="button" variant="outline" onClick={downloadErrors}><FileWarning size={14} aria-hidden="true" />Download errors</Button>}<Button type="button" variant="outline" disabled={!state.mappedFile || state.status === "uploading"} onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? "Close preview" : "Preview"}</Button><Button type="button" disabled={!state.validation?.canImport || state.status === "importing"} onClick={onImport}><CheckCircle2 size={15} aria-hidden="true" />Import</Button></div></div>
    </Card>
  );
}

function ImportAllPreflight({ states, history }: { states: Record<ImportModule, ModuleState>; history: ImportHistoryRecord[] }) {
  return (
    <Card id="import-all-preflight" className="space-y-4 border-[var(--border-default)] p-4" aria-labelledby="import-all-preflight-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="import-all-preflight-title" className="text-base font-semibold text-[var(--text-primary)]">Import All preflight</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">A presentation of the existing module readiness checks. Import eligibility remains unchanged.</p></div><span className="text-xs font-semibold text-[var(--text-tertiary)]">3 modules · sequential run</span></div>
      <div className="grid gap-3 lg:grid-cols-3">
        {modules.map(({ id, label }) => {
          const state = states[id];
          const readiness = preflightFor(state);
          const latest = latestHistoryFor(history, id);
          return <div key={id} className="rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] p-3" aria-label={`${label} preflight`}><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p><StatePill label={readiness.label} tone={readiness.tone} /></div><p className="mt-2 truncate text-xs text-[var(--text-secondary)]" title={state.sourceFile?.name}>{state.sourceFile?.name ?? "No file selected"}</p><p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{readiness.detail}</p><div className="mt-3 grid grid-cols-3 gap-2"><Metric label="Valid" value={state.validation?.validRows ?? "—"} tone="positive" /><Metric label="Warnings" value={warningCount(state)} tone="warning" /><Metric label="Errors" value={errorCount(state)} tone={errorCount(state) ? "negative" : "neutral"} /></div>{latest && <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">Last persisted: {latest.success.toLocaleString()} rows · {formatStatusLabel(latest.status)}</p>}</div>;
        })}
      </div>
    </Card>
  );
}

function ImportAllProgress({ busy, summary, states, history }: { busy: boolean; summary: string | null; states: Record<ImportModule, ModuleState>; history: ImportHistoryRecord[] }) {
  if (!busy && !summary) return null;
  const completed = modules.filter(({ id }) => states[id].status === "success").map(({ id }) => id);
  const failed = modules.filter(({ id }) => states[id].status === "failed").map(({ id }) => id);
  const active = modules.find(({ id }) => states[id].status === "importing")?.id ?? null;
  const completedCount = completed.length;
  const isFailure = failed.length > 0;
  const activeLabel = active ? modules.find((item) => item.id === active)?.label : null;
  const heading = busy ? "Import All in progress" : isFailure ? "Import All completed with issues" : "Import All completed";
  return (
    <Card className="space-y-4 border-[var(--border-default)] p-4" role={isFailure && !busy ? "alert" : "status"} aria-live={isFailure && !busy ? "assertive" : "polite"} aria-labelledby="import-all-progress-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="import-all-progress-title" className="text-base font-semibold text-[var(--text-primary)]">{heading}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{busy ? activeLabel ? `${activeLabel} is importing now.` : "Preparing the next module." : summary ?? "Run finished."}</p></div><span className="kmm-tabular text-sm font-semibold text-[var(--text-primary)]">{completedCount} / {modules.length} succeeded</span></div>
      <div className="space-y-1"><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-200" style={{ width: `${(completedCount / modules.length) * 100}%` }} /></div><div className="flex justify-between text-[10px] text-[var(--text-tertiary)]"><span>{busy ? "Sequential progress" : "Persisted result"}</span><span>{completedCount} of {modules.length} modules complete</span></div><div className="sr-only" role="progressbar" aria-valuemin={0} aria-valuemax={modules.length} aria-valuenow={completedCount} aria-label={`Import All progress: ${completedCount} of ${modules.length} modules complete`} /></div>
      <div className="grid gap-2 sm:grid-cols-3">
        {modules.map(({ id, label }) => {
          const isActive = active === id;
          const isComplete = completed.includes(id);
          const isFailed = failed.includes(id);
          const state = states[id];
          const record = latestHistoryFor(history, id);
          const rowCount = isComplete ? record?.success ?? state.validation?.validRows ?? 0 : 0;
          const itemLabel = isActive ? "Importing" : isComplete ? "Success" : isFailed ? "Failed" : "Waiting";
          const itemTone: StatusTone = isActive ? "warning" : isComplete ? "positive" : isFailed ? "negative" : "neutral";
          return <div key={id} className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-2"><div className="min-w-0"><p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p><p className="truncate text-[10px] text-[var(--text-tertiary)]">{isComplete ? `${rowCount.toLocaleString()} rows` : isFailed ? state.error ?? "Import failed" : isActive ? "Writing approved rows" : "Queued"}</p></div><StatePill label={itemLabel} tone={itemTone} /></div>;
        })}
      </div>
      {!busy && summary && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider)] pt-3"><p className="text-xs text-[var(--text-secondary)]">The existing dashboard refresh event has been emitted for successful modules.</p><a href="/dashboard" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand-500)] px-4 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--brand-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">Open Dashboard <ArrowRight size={15} aria-hidden="true" /></a></div>}
    </Card>
  );
}

function LatestUpdates({ history, statuses, now }: { history: ImportHistoryRecord[]; statuses: Array<{ module: string; lastUpdate: string | null; status: string }>; now: number }) {
  return (
    <section aria-labelledby="latest-updates-title"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="latest-updates-title" className="text-lg font-semibold text-[var(--text-primary)]">Latest Updates</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Current persisted dataset status for KMM, using available import provenance.</p></div></div><div className="grid gap-3 md:grid-cols-3">
      {modules.map(({ id, label }) => {
        const latest = latestHistoryFor(history, id);
        const apiStatus = statuses.find((item) => normalizeModule(item.module) === id);
        const lastUpdate = latest?.importedAt ?? apiStatus?.lastUpdate ?? null;
        const stale = !lastUpdate || now - new Date(lastUpdate).getTime() > 30 * 86_400_000;
        const status = latest?.status ?? apiStatus?.status ?? "not_updated";
        const statusLabel = status === "not_updated" ? "Not updated" : formatStatusLabel(status);
        const tone = status === "success" ? "positive" : status === "failed" ? "negative" : stale ? "warning" : "neutral";
        return <Card key={id} className={stale ? "border-[var(--status-warning)]/50" : ""}><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p><StatePill label={statusLabel} tone={tone} /></div><dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-[var(--text-secondary)]">File</dt><dd className="max-w-[12rem] truncate text-right font-medium text-[var(--text-primary)]" title={latest?.filename}>{latest?.filename ?? "No persisted file"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--text-secondary)]">Imported</dt><dd className="text-right text-[var(--text-primary)]">{lastUpdate ? <time dateTime={lastUpdate}>{new Date(lastUpdate).toLocaleString()}</time> : "Not updated"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--text-secondary)]">Rows</dt><dd className="kmm-tabular font-semibold text-[var(--text-primary)]">{latest ? latest.success.toLocaleString() : "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--text-secondary)]">Warnings / errors</dt><dd className="kmm-tabular text-right text-[var(--text-primary)]">{latest ? `${latest.warning.toLocaleString()} / ${latest.error.toLocaleString()}` : "—"}</dd></div></dl>{stale && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--status-warning)]"><AlertTriangle size={13} aria-hidden="true" />{lastUpdate ? "Needs a recent update" : "No import recorded yet"}</p>}</Card>;
      })}
    </div></section>
  );
}

function ImportHistorySection({ history }: { history: ImportHistoryRecord[] }) {
  const [moduleFilter, setModuleFilter] = useState<"all" | ImportModule>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30">("all");
  const [visibleLimit, setVisibleLimit] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const filtered = useMemo(() => {
    const cutoff = dateFilter === "all" ? null : now - Number(dateFilter) * 86_400_000;
    return history.filter((record) => {
      const moduleMatches = moduleFilter === "all" || normalizeModule(record.module) === moduleFilter;
      const statusMatches = statusFilter === "all" || record.status === statusFilter;
      const importedAt = new Date(record.importedAt).getTime();
      const dateMatches = cutoff === null || (Number.isFinite(importedAt) && importedAt >= cutoff);
      return moduleMatches && statusMatches && dateMatches;
    });
  }, [dateFilter, history, moduleFilter, now, statusFilter]);
  const visible = filtered.slice(0, visibleLimit);
  return <section aria-labelledby="import-history-title"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 id="import-history-title" className="text-lg font-semibold text-[var(--text-primary)]">Import History</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Append-only audit records. Filtering and disclosure are local presentation controls.</p></div><History className="text-[var(--text-tertiary)]" size={19} aria-hidden="true" /></div><Card className="overflow-hidden p-0"><div className="flex flex-wrap gap-2 border-b border-[var(--divider)] bg-[var(--surface-subtle)] px-4 py-3" aria-label="Import history filters"><label className="text-[11px] font-semibold text-[var(--text-secondary)]">Module<select aria-label="Filter import history by module" className="ml-2 min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-2 text-xs font-normal text-[var(--text-primary)]" value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value as "all" | ImportModule); setVisibleLimit(10); }}><option value="all">All modules</option>{modules.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label><label className="text-[11px] font-semibold text-[var(--text-secondary)]">Status<select aria-label="Filter import history by status" className="ml-2 min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-2 text-xs font-normal text-[var(--text-primary)]" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "all" | "success" | "failed"); setVisibleLimit(10); }}><option value="all">All statuses</option><option value="success">Success</option><option value="failed">Failed</option></select></label><label className="text-[11px] font-semibold text-[var(--text-secondary)]">Date<select aria-label="Filter import history by date" className="ml-2 min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-2 text-xs font-normal text-[var(--text-primary)]" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value as "all" | "7" | "30"); setVisibleLimit(10); }}><option value="all">All dates</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label></div>{filtered.length === 0 ? <p className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">No import history matches these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-[var(--divider)] text-xs text-[var(--text-tertiary)]"><th className="px-4 py-3 font-semibold">Module</th><th className="px-4 py-3 font-semibold">File name</th><th className="px-4 py-3 font-semibold">Import time</th><th className="px-4 py-3 font-semibold">Rows</th><th className="px-4 py-3 font-semibold">Warnings</th><th className="px-4 py-3 font-semibold">Errors</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Details</th></tr></thead><tbody>{visible.map((record) => { const expanded = expandedId === record.id; const failed = record.status === "failed"; return <Fragment key={record.id}><tr className="border-b border-[var(--divider)] last:border-0"><td className="px-4 py-3 font-medium capitalize">{formatStatusLabel(record.module)}</td><td className="max-w-48 truncate px-4 py-3" title={record.filename}>{record.filename}</td><td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]"><time dateTime={record.importedAt}>{new Date(record.importedAt).toLocaleString()}</time></td><td className="kmm-tabular px-4 py-3">{record.success.toLocaleString()}</td><td className="kmm-tabular px-4 py-3 text-[var(--status-warning)]">{record.warning.toLocaleString()}</td><td className="kmm-tabular px-4 py-3 text-[var(--status-danger)]">{record.error.toLocaleString()}</td><td className="px-4 py-3"><StatePill label={formatStatusLabel(record.status)} tone={record.status === "success" ? "positive" : "negative"} /></td><td className="px-4 py-3">{failed && <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] px-2 text-xs font-semibold text-[var(--brand-700)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : record.id)}>{expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />} {expanded ? "Hide" : "View"}</button>}</td></tr>{expanded && <tr className="border-b border-[var(--divider)] bg-[var(--status-danger-bg)]"><td colSpan={8} className="px-4 py-3 text-xs text-[var(--status-danger)]"><span className="font-semibold">Failure details:</span> {record.failureReason ?? (record.error > 0 ? `${record.error.toLocaleString()} error row(s) recorded.` : "No detailed error text was provided by the import record.")}</td></tr>}</Fragment>; })}</tbody></table></div>}{visible.length < filtered.length && <div className="flex justify-center border-t border-[var(--divider)] px-4 py-3"><Button type="button" variant="outline" onClick={() => setVisibleLimit((limit) => limit + 10)}>Show more history</Button></div>}<p className="px-4 py-3 text-[11px] text-[var(--text-tertiary)]" aria-live="polite">Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} matching records.</p></Card></section>;
}

export function UnifiedImportCenter() {
  const [states, setStates] = useState<Record<ImportModule, ModuleState>>({ sales: emptyState(), booking: emptyState(), stock: emptyState() });
  const [history, setHistory] = useState<ImportHistoryRecord[]>([]);
  const [statuses, setStatuses] = useState<Array<{ module: string; lastUpdate: string | null; status: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const loadHistory = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const response = await fetch("/api/data-hub/import", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { history: ImportHistoryRecord[]; statuses: Array<{ module: string; lastUpdate: string | null; status: string }> };
    setHistory(payload.history);
    setStatuses(payload.statuses);
  };
  useEffect(() => { void loadHistory(); }, []);

  const chooseFile = async (module: ImportModule, file: File, options: SpreadsheetParseOptions = {}) => {
    setStates((current) => ({ ...current, [module]: { ...current[module], sourceFile: file, status: "uploading", error: null, validation: null } }));
    try {
      const parsed = await parseSpreadsheetFile(file, { ...options, module });
      if (parsed.structureError) {
        setStates((current) => ({ ...current, [module]: { ...current[module], sourceFile: file, file: parsed, mappedFile: null, mappings: [], validation: null, status: "failed", error: parsed.structureError } }));
        return;
      }
      const source = getImportSourceDefinition(module, "product");
      const mappings = createColumnMappings(source, parsed.headers, loadSavedMapping(module), parsed.inferredFields);
      const mappedFile = applyColumnMappings(parsed, mappings);
      const validation = validateImportRows(source, mappedFile.headers, mappedFile.rows, { quantityRule: parsed.quantityRule, duplicateRule: parsed.duplicateRule, sourceRowNumbers: parsed.sourceRowNumbers, sourceRowSignatures: parsed.sourceRowSignatures });
      const validationError = validation.missingColumns.length
        ? `Missing required columns: ${validation.missingColumns.join(", ")}`
        : `Resolve ${validation.invalidRows} validation error(s).`;
      setStates((current) => ({ ...current, [module]: { sourceFile: file, file: parsed, mappedFile, mappings, validation, year: parsed.detection?.year.value, month: parsed.detection?.month.value, status: validation.canImport ? "valid" : "failed", error: validation.canImport ? null : validationError } }));
    } catch (error) {
      setStates((current) => ({ ...current, [module]: { ...current[module], status: "failed", error: error instanceof Error ? error.message : "Unable to read this file." } }));
    }
  };

  const importOne = async (module: ImportModule, emitRefresh: boolean) => {
    const state = states[module];
    if (!state.file || !state.mappedFile || !state.validation?.canImport) throw new Error(`${module} is not ready to import.`);
    const year = state.year;
    const month = state.month;
    if (!year || !month || month < 1 || month > 12) throw new Error(`${module} period detection failed. Enter a valid year and month before importing.`);
    setStates((current) => ({ ...current, [module]: { ...current[module], status: "importing", error: null } }));
    try {
      const record = await completeUnifiedModuleImport({ module, file: state.mappedFile, validation: state.validation, year, month, businessWeek: state.file.detection?.businessWeek.value ?? null, emitRefresh });
      setStates((current) => ({ ...current, [module]: { ...current[module], status: "success" } }));
      setHistory((current) => [record, ...current]);
      return record;
    } catch (error) {
      setStates((current) => ({ ...current, [module]: { ...current[module], status: "failed", error: error instanceof Error ? error.message : "Import failed." } }));
      throw error;
    }
  };

  const importAll = async () => {
    setBusy(true);
    setSummary(null);
    setStates((current) => {
      const next = { ...current };
      modules.forEach(({ id }) => {
        const state = current[id];
        if (state.status === "success" || (state.status === "failed" && state.validation?.canImport)) {
          next[id] = { ...state, status: state.validation?.canImport ? "valid" : "ready", error: null };
        }
      });
      return next;
    });
    const successful: ImportModule[] = [];
    const failed: ImportModule[] = [];
    for (const { id } of modules) {
      try {
        await importOne(id, false);
        successful.push(id);
      } catch (error) {
        failed.push(id);
        const message = error instanceof Error ? error.message : "Import failed.";
        setStates((current) => ({ ...current, [id]: { ...current[id], status: "failed", error: current[id].error ?? message } }));
      }
    }
    if (successful.length && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kmm:sales-imported", { detail: { modules: successful } }));
    await loadHistory();
    setBusy(false);
    setSummary(`Import All complete: ${successful.length} succeeded${failed.length ? `, ${failed.length} failed (${failed.join(", ")})` : "."}`);
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-600)]">Data Hub · KMM</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Import Center</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">Upload, validate, preview and update Sales, Booking and Stock from one place.</p></div><Button type="button" aria-describedby="import-all-preflight" disabled={busy || modules.some(({ id }) => states[id].status === "importing")} onClick={() => void importAll()}><RefreshCw size={15} aria-hidden="true" /> Import All</Button></div>
    <ImportAllPreflight states={states} history={history} />
    <ImportAllProgress busy={busy} summary={summary} states={states} history={history} />
    <div className="grid gap-4 xl:grid-cols-3">{modules.map(({ id, label, icon: Icon }) => <ImportCard key={id} module={id} label={label} icon={Icon} state={states[id]} latestRecord={latestHistoryFor(history, id)} onFile={(file) => void chooseFile(id, file)} onStructureChange={(sheetName, headerRow) => { const file = states[id].sourceFile; if (file) void chooseFile(id, file, { sheetName, headerRow }); }} onPeriodChange={(year, month) => setStates((current) => ({ ...current, [id]: { ...current[id], year, month } }))} onImport={() => void importOne(id, true)} />)}</div>
    <LatestUpdates history={history} statuses={statuses} now={now} />
    <ImportHistorySection history={history} />
  </div>;
}
