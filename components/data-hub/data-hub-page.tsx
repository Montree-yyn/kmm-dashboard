"use client";

import {
  ArrowRight,
  Banknote,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Download,
  FileSpreadsheet,
  History,
  Megaphone,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Rows3,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth } from "../../lib/firebase";
import {
  completeSessionImport,
  recordSessionImportFailure,
} from "../../lib/data-hub/import-service";
import {
  applyColumnMappings,
  createColumnMappings,
  isMappableModule,
  loadSavedMapping,
  saveMapping,
  updateColumnMapping,
  type ColumnMapping,
} from "../../lib/data-hub/column-mapping";
import { parseSpreadsheetFile } from "../../lib/data-hub/parse-spreadsheet";
import {
  getImportSourceDefinition,
  masterDataDefinitions,
  visibleDataSources,
} from "../../lib/data-hub/source-definitions";
import type {
  DataModule,
  ImportHistoryRecord,
  ImportStatus,
  MasterDataType,
  ParsedImportFile,
  ValidationSummary,
} from "../../lib/data-hub/types";
import { validateImportRows } from "../../lib/data-hub/validate-import";
import { cn } from "../../lib/utils";
import { KpiCard } from "../design-system/kpi-card";
import { StatusBadge } from "../design-system/status-badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { DataMappingPanel } from "./data-mapping-panel";

const moduleIcons: Record<DataModule, typeof Banknote> = {
  sales: Banknote,
  booking: CalendarCheck2,
  stock: PackageSearch,
  expense: ReceiptText,
  marketing: Megaphone,
  team: Users,
  master_data: Database,
};

const workflowSteps = [
  "Upload",
  "Preview",
  "Validate",
  "Approve",
  "Import",
  "Dashboard Update",
  "Completed",
] as const;

const importStatusMeta: Record<
  ImportStatus,
  { label: string; detail: string; className: string }
> = {
  ready: {
    label: "Ready",
    detail: "Select a source and upload a file.",
    className: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  },
  uploading: {
    label: "Uploading",
    detail: "Reading the selected spreadsheet.",
    className: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  },
  validating: {
    label: "Validating",
    detail: "Checking columns and row quality.",
    className: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  },
  warning: {
    label: "Warning",
    detail: "The file can proceed, with non-blocking data warnings to review.",
    className: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  },
  importing: {
    label: "Importing",
    detail: "Recording this validated session import.",
    className: "bg-blue-50 text-blue-700",
  },
  success: {
    label: "Success",
    detail: "The dashboard session has been updated.",
    className: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  },
  failed: {
    label: "Failed",
    detail: "Review the error report and upload a corrected file.",
    className: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
  },
  rollback: {
    label: "Rollback",
    detail: "Rollback is reserved for the future persistent import service.",
    className: "bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
  },
};

function formatCell(value: unknown) {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(value);
  }
  if (value === null || value === undefined || value === "") return "Empty";
  return String(value);
}

function formatImportTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatImportDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(value));
}

function formatUserLabel(value: string) {
  return value.includes("@") ? value.split("@")[0] : value;
}

function DataSourceSelector({
  selected,
  onSelect,
}: {
  selected: DataModule;
  onSelect: (module: DataModule) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7"
      role="list"
      aria-label="Data sources"
    >
      {visibleDataSources.map((source) => {
        const Icon = moduleIcons[source.id];
        const active = source.id === selected;
        const isMasterData = source.id === "master_data";
        return (
          <button
            key={source.id}
            type="button"
            className={cn(
              "flex min-h-[76px] min-w-0 items-center gap-3 rounded-[var(--radius-control-lg)] border px-3 py-3 text-left transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              active
                ? "border-[var(--brand-500)] bg-[var(--brand-50)]"
                : "border-[var(--border-default)] bg-[var(--surface-default)] hover:border-[var(--text-disabled)] hover:bg-[var(--surface-subtle)]",
            )}
            aria-pressed={active}
            onClick={() => onSelect(source.id)}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)]",
                active
                  ? "bg-[var(--brand-100)] text-[var(--brand-600)]"
                  : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
              )}
              aria-hidden="true"
            >
              {isMasterData ? <Sparkles size={19} /> : <Icon size={19} />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                {source.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-[var(--text-tertiary)]">
                {isMasterData
                  ? `${masterDataDefinitions.length} data types`
                  : `${source.fields.length} columns`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MasterDataSelector({
  selected,
  onSelect,
}: {
  selected: MasterDataType;
  onSelect: (type: MasterDataType) => void;
}) {
  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Master Data type
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Select the reference data schema to validate.
          </p>
        </div>
        <StatusBadge status="active">Extensible registry</StatusBadge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-5">
        {masterDataDefinitions.map((definition) => {
          const active = definition.id === selected;
          return (
            <button
              key={definition.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(definition.id)}
              className={cn(
                "min-h-11 rounded-[var(--radius-control)] border px-3 text-left text-xs font-semibold transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                active
                  ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
              )}
            >
              {definition.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowProgress({ currentStep }: { currentStep: number }) {
  return (
    <ol
      className="grid grid-cols-7 border-b border-[var(--divider)]"
      aria-label="Import progress"
    >
      {workflowSteps.map((label, index) => {
        const complete = index < currentStep;
        const active = index === currentStep;
        return (
          <li
            key={label}
            className={cn(
              "relative flex min-w-0 flex-col items-center gap-1.5 px-1 pb-3 text-center text-[9px] font-semibold leading-4 sm:flex-row sm:justify-center sm:text-[11px]",
              active
                ? "text-[var(--brand-600)]"
                : complete
                  ? "text-[var(--status-success)]"
                  : "text-[var(--text-tertiary)]",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border text-[10px]",
                active && "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-600)]",
                complete && "border-[var(--status-success)] bg-[var(--status-success-bg)] text-[var(--status-success)]",
                !active && !complete && "border-[var(--border-default)] bg-[var(--surface-subtle)]",
              )}
            >
              {complete ? <Check size={13} aria-hidden="true" /> : index + 1}
            </span>
            <span className="truncate">{label}</span>
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--brand-500)]" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function FileDropzone({ busy, filename, onFile }: { busy: boolean; filename?: string; onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  function receiveFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }
  return (
    <div
      className={cn("grid min-h-[230px] place-items-center rounded-[var(--radius-card)] border border-dashed p-6 text-center transition-[border-color,background-color] duration-150", dragging ? "border-[var(--brand-500)] bg-[var(--brand-50)]" : "border-[var(--border-default)] bg-[var(--surface-subtle)]")}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); receiveFiles(event.dataTransfer.files); }}
    >
      <div className="max-w-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--brand-50)] text-[var(--brand-600)]" aria-hidden="true">
          {busy ? <RefreshCw className="animate-spin" size={22} /> : <UploadCloud size={22} />}
        </span>
        <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
          {busy ? "Reading spreadsheet" : filename ?? "Upload a data file"}
        </h3>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Drag and drop or choose an XLSX, XLS or CSV file. Maximum 20 MB and 50,000 rows.</p>
        <Button type="button" className="mt-4" disabled={busy} onClick={() => inputRef.current?.click()}>
          <FileSpreadsheet size={17} aria-hidden="true" /> Choose file
        </Button>
        <input ref={inputRef} className="sr-only" type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={(event: ChangeEvent<HTMLInputElement>) => { receiveFiles(event.target.files); event.target.value = ""; }} aria-label="Choose spreadsheet to import" />
      </div>
    </div>
  );
}

function PreviewTable({ file }: { file: ParsedImportFile }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-base font-semibold text-[var(--text-primary)]">File preview</h3><p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{file.sheetName} · {file.rows.length.toLocaleString()} rows · {file.headers.length} columns</p></div>
        <StatusBadge status="neutral">{file.extension.toUpperCase()}</StatusBadge>
      </div>
      <div className="max-h-[320px] overflow-auto rounded-[var(--radius-control-lg)] border border-[var(--border-default)]">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs"><thead className="sticky top-0 z-10 bg-[var(--surface-subtle)]"><tr><th className="w-14 border-b border-[var(--divider)] px-3 py-2.5 font-semibold text-[var(--text-tertiary)]">Row</th>{file.headers.map((header) => <th key={header} className="whitespace-nowrap border-b border-[var(--divider)] px-3 py-2.5 font-semibold text-[var(--text-secondary)]">{header}</th>)}</tr></thead><tbody>{file.rows.slice(0, 8).map((row, index) => <tr key={index} className="border-b border-[var(--divider)] last:border-b-0 hover:bg-[var(--surface-subtle)]"><td className="kmm-tabular px-3 py-2.5 text-[var(--text-tertiary)]">{index + 2}</td>{file.headers.map((header) => <td key={header} className={cn("max-w-56 truncate px-3 py-2.5 text-[var(--text-primary)]", (row[header] === null || row[header] === undefined || row[header] === "") && "italic text-[var(--status-warning)]")} title={formatCell(row[header])}>{formatCell(row[header])}</td>)}</tr>)}</tbody></table>
      </div>
      {file.rows.length > 8 && <p className="mt-2 text-right text-[11px] text-[var(--text-tertiary)]">Previewing 8 of {file.rows.length.toLocaleString()} rows</p>}
    </div>
  );
}

function ValidationPanel({ summary }: { summary: ValidationSummary }) {
  const metrics = [["Valid rows", summary.validRows, "success"], ["Warnings", summary.warningCells, "warning"], ["Duplicates", summary.duplicateRows, "warning"], ["Wrong type", summary.wrongTypeCells, "danger"]] as const;
  return (
    <div aria-live="polite">
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-[var(--text-primary)]">Validation summary</h3><p className="mt-0.5 text-xs text-[var(--text-tertiary)]">All blocking issues must be resolved before approval.</p></div><StatusBadge status={summary.canImport ? "positive" : "warning"}>{summary.canImport ? "Ready for approval" : "Needs attention"}</StatusBadge></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map(([label, value, tone]) => <div key={label} className="rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] px-3 py-3"><p className="text-[11px] font-medium text-[var(--text-tertiary)]">{label}</p><p className={cn("kmm-tabular mt-1 text-xl font-semibold", tone === "success" && "text-[var(--status-success)]", tone === "warning" && "text-[var(--status-warning)]", tone === "danger" && "text-[var(--status-danger)]")}>{value.toLocaleString()}</p></div>)}</div>
      {summary.missingColumns.length > 0 && <div className="mt-3 rounded-[var(--radius-control-lg)] bg-[var(--status-danger-bg)] px-3 py-3 text-sm text-[var(--status-danger)]">Missing columns: {summary.missingColumns.join(", ")}</div>}
      {summary.issues.length > 0 && <ul className="mt-3 max-h-32 space-y-1 overflow-auto text-xs text-[var(--text-secondary)]">{summary.issues.slice(0, 20).map((issue, index) => <li key={`${issue.code}-${issue.row ?? 0}-${index}`}>{issue.message}</li>)}{summary.issues.length > 20 && <li className="font-semibold">And {summary.issues.length - 20} more issues</li>}</ul>}
    </div>
  );
}

function formatDuration(durationMs: number) {
  return durationMs < 1_000 ? "<1s" : `${(durationMs / 1_000).toFixed(1)}s`;
}

function ImportHistoryTable({ history }: { history: ImportHistoryRecord[] }) {
  if (history.length === 0) return <div className="grid min-h-52 place-items-center px-6 py-10 text-center"><div className="max-w-sm"><span className="mx-auto grid size-11 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] text-[var(--text-tertiary)]" aria-hidden="true"><History size={20} /></span><h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">No imports yet</h3><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Validated imports completed in this session will appear here.</p></div></div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[1220px] border-collapse text-left text-sm"><thead><tr className="border-b border-[var(--divider)] text-xs text-[var(--text-tertiary)]">{["File Name", "Module", "Rows", "Success", "Warning", "Error", "Imported By", "Date Time", "Duration", "Rollback"].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{history.map((record) => <tr key={record.id} className="border-b border-[var(--divider)] last:border-0 hover:bg-[var(--surface-subtle)]"><td className="max-w-56 truncate px-3 py-3 font-medium text-[var(--text-primary)]">{record.filename}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{record.module}</td><td className="kmm-tabular px-3 py-3 text-right">{record.rows.toLocaleString()}</td><td className="kmm-tabular px-3 py-3 text-right text-[var(--status-success)]">{record.success.toLocaleString()}</td><td className="kmm-tabular px-3 py-3 text-right text-[var(--status-warning)]">{record.warning.toLocaleString()}</td><td className="kmm-tabular px-3 py-3 text-right text-[var(--status-danger)]">{record.error.toLocaleString()}</td><td className="px-3 py-3"><span className={cn("inline-flex rounded-full px-2 py-1 text-[11px] font-semibold", importStatusMeta[record.status].className)}>{importStatusMeta[record.status].label}</span></td><td className="max-w-44 truncate px-3 py-3 text-[var(--text-secondary)]">{record.importedBy}</td><td className="whitespace-nowrap px-3 py-3 text-[var(--text-secondary)]">{formatImportTime(record.importedAt)}</td><td className="kmm-tabular whitespace-nowrap px-3 py-3 text-[var(--text-secondary)]">{formatDuration(record.durationMs)}</td><td className="px-3 py-3"><button type="button" disabled className="min-h-9 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-disabled)]" title="Rollback will be enabled with database persistence">Planned</button></td></tr>)}</tbody></table></div>;
}

function CurrentImportStatus({ status, error, rowsFailed, onDownloadErrorReport }: { status: ImportStatus; error: string | null; rowsFailed: number; onDownloadErrorReport: () => void }) {
  const meta = importStatusMeta[status];
  return <Card className="min-h-[154px] rounded-[var(--radius-card)] border-[var(--border-default)] p-4 shadow-[var(--shadow-card)]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-[var(--text-secondary)]">Current Import Status</p><span className={cn("mt-3 inline-flex rounded-full px-2.5 py-1 text-sm font-semibold", meta.className)}>{meta.label}</span></div><ShieldCheck className="text-[var(--brand-600)]" size={18} aria-hidden="true" /></div>{status === "failed" ? <div className="mt-3 text-xs leading-5"><p className="text-[var(--status-danger)]">Reason: {error ?? "Validation failed."}</p><p className="kmm-tabular text-[var(--text-secondary)]">Rows failed: {rowsFailed.toLocaleString()}</p><button type="button" onClick={onDownloadErrorReport} className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-[var(--brand-700)] underline decoration-[var(--brand-300)] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Download size={14} aria-hidden="true" />Download Error Report</button></div> : <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{meta.detail}</p>}</Card>;
}

export function DataHubPage() {
  const [activeTab, setActiveTab] = useState<"import" | "mapping">("import");
  const [selectedModule, setSelectedModule] = useState<DataModule>("sales");
  const [selectedMasterData, setSelectedMasterData] = useState<MasterDataType>("product");
  const [parsedFile, setParsedFile] = useState<ParsedImportFile | null>(null);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [history, setHistory] = useState<ImportHistoryRecord[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("ready");
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [mappingSaved, setMappingSaved] = useState(false);
  const source = getImportSourceDefinition(selectedModule, selectedMasterData);
  const mappable = isMappableModule(selectedModule, selectedMasterData);
  const mappedFile = useMemo(
    () => (parsedFile && mappable ? applyColumnMappings(parsedFile, columnMappings) : parsedFile),
    [columnMappings, mappable, parsedFile],
  );
  const currentStep = importStatus === "success" ? 6 : importStatus === "importing" ? 4 : approved ? 4 : validation?.canImport ? 3 : validation ? 2 : parsedFile ? 1 : 0;
  const totalImportedRecords = useMemo(() => history.reduce((total, record) => total + record.success, 0), [history]);
  const latestImport = history[0];

  function resetImport(module = selectedModule) { setSelectedModule(module); setParsedFile(null); setValidation(null); setError(null); setApproved(false); setColumnMappings([]); setMappingSaved(false); setImportStatus("ready"); }
  function selectMasterData(type: MasterDataType) { setSelectedMasterData(type); resetImport("master_data"); }
  function currentUserLabel() { return auth.currentUser?.displayName ?? auth.currentUser?.email ?? "Authenticated user"; }
  function recordFailure(filename: string, reason: string, summary?: ValidationSummary | null) { setHistory((current) => [recordSessionImportFailure({ source, filename, user: currentUserLabel(), reason, validation: summary }), ...current]); }
  async function handleFile(file: File) { setReading(true); setError(null); setValidation(null); setApproved(false); setMappingSaved(false); setImportStatus("uploading"); try { const parsed = await parseSpreadsheetFile(file); setParsedFile(parsed); const mappings = mappable ? createColumnMappings(source, parsed.headers, loadSavedMapping(selectedModule)) : []; setColumnMappings(mappings); setImportStatus(mappings.some((mapping) => mapping.status === "warning") ? "warning" : "ready"); } catch (caught) { const reason = caught instanceof Error ? caught.message : "Unable to read this file."; setParsedFile(null); setError(reason); setImportStatus("failed"); recordFailure(file.name, reason); } finally { setReading(false); } }
  function validateFile() { if (!mappedFile) return; setImportStatus("validating"); const summary = validateImportRows(source, mappedFile.headers, mappedFile.rows); setValidation(summary); setApproved(false); if (summary.canImport) { setError(null); setImportStatus(summary.warningCells > 0 || columnMappings.some((mapping) => mapping.status === "warning") ? "warning" : "ready"); } else { const reason = summary.missingColumns.length > 0 ? `Missing required columns: ${summary.missingColumns.join(", ")}` : "Validation found data quality issues."; setError(reason); setImportStatus("failed"); recordFailure(mappedFile.filename, reason, summary); } }
  function approveImport() { if (!validation?.canImport) return; setApproved(true); setError(null); setImportStatus(validation.warningCells > 0 ? "warning" : "ready"); }
  function changeMapping(excelColumn: string, fieldKey: string | null) { setColumnMappings((current) => updateColumnMapping(source, current, excelColumn, fieldKey)); setValidation(null); setApproved(false); setMappingSaved(false); }
  function saveCurrentMapping() { if (!mappable) return; saveMapping(selectedModule, columnMappings); setMappingSaved(true); }
  async function importFile() { if (!mappedFile || !validation?.canImport || !approved) return; setImporting(true); setError(null); setImportStatus("importing"); try { const record = await completeSessionImport({ source, file: mappedFile, validation, user: currentUserLabel() }); setHistory((current) => [record, ...current]); setImportStatus("success"); } catch (caught) { const reason = caught instanceof Error ? caught.message : "Unable to complete this import."; setError(reason); setImportStatus("failed"); recordFailure(mappedFile.filename, reason, validation); } finally { setImporting(false); } }
  function downloadErrorReport() { const rows = validation?.issues.length ? validation.issues.map((issue) => [issue.code, issue.row ?? "", issue.column ?? "", issue.message]) : [["file_error", "", "", error ?? "Unable to process this file."]]; const csv = ["Issue,Row,Column,Message", ...rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${parsedFile?.filename.replace(/\.[^.]+$/, "") ?? "import"}-error-report.csv`; anchor.click(); URL.revokeObjectURL(url); }

  return <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]"><main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6"><div className="space-y-5 xl:space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end" aria-labelledby="data-hub-title"><div><div className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]" aria-hidden="true" /><h1 id="data-hub-title" className="text-[28px] font-semibold leading-tight tracking-normal sm:text-[30px]">Data Hub</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Enterprise Data Hub for controlled data validation, approval and imports.</p></div><StatusBadge status="active" className="self-start sm:self-auto">v1.2 · Data gateway</StatusBadge></section>
    <div className="flex items-center gap-1 border-b border-[var(--divider)]" role="tablist" aria-label="Data Hub workspace"><button type="button" role="tab" aria-selected={activeTab === "import"} onClick={() => setActiveTab("import")} className={cn("min-h-11 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", activeTab === "import" ? "border-[var(--brand-500)] text-[var(--brand-700)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>Import</button><button type="button" role="tab" aria-selected={activeTab === "mapping"} onClick={() => setActiveTab("mapping")} className={cn("min-h-11 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", activeTab === "mapping" ? "border-[var(--brand-500)] text-[var(--brand-700)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>Data Mapping</button></div>
    {activeTab === "mapping" && (mappable ? <DataMappingPanel source={source} file={parsedFile} mappings={columnMappings} saved={mappingSaved} onChange={changeMapping} onSave={saveCurrentMapping} onOpenImport={() => setActiveTab("import")} /> : <Card className="p-5 text-sm text-[var(--text-secondary)]">Data Mapping is available for Sales, Booking, Stock, Marketing, Expense and Team imports.</Card>)}
    {activeTab === "import" && <>
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Import status overview"><CurrentImportStatus status={importStatus} error={error} rowsFailed={validation?.invalidRows ?? 0} onDownloadErrorReport={downloadErrorReport} /><KpiCard variant="executive" title="Last Import" value={latestImport ? formatImportDate(latestImport.importedAt) : "Not yet"} subtitle={latestImport ? `${latestImport.module} · ${latestImport.rows.toLocaleString()} rows` : "No imports completed"} icon={<Clock3 size={18} />} /><KpiCard variant="executive" title="Total Records" value={totalImportedRecords.toLocaleString()} unit="rows" subtitle="Imported in this session" icon={<Rows3 size={18} />} /><KpiCard variant="executive" title="Last User" value={latestImport ? formatUserLabel(latestImport.importedBy) : "Not yet"} subtitle={latestImport ? `${latestImport.module} import` : "No imports completed"} icon={<UserRound size={18} />} /></section>
    <section aria-labelledby="data-sources-title"><div className="mb-3"><h2 id="data-sources-title" className="text-lg font-semibold text-[var(--text-primary)]">Data sources</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Select the destination module before uploading a file.</p></div><DataSourceSelector selected={selectedModule} onSelect={resetImport} />{selectedModule === "master_data" && <MasterDataSelector selected={selectedMasterData} onSelect={selectMasterData} />}</section>
    <Card className="overflow-hidden rounded-[var(--radius-card)] border-[var(--border-default)] shadow-[var(--shadow-card)]"><div className="flex flex-col gap-3 border-b border-[var(--divider)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-lg font-semibold text-[var(--text-primary)]">{source.label} import</h2><p className="mt-0.5 text-xs text-[var(--text-secondary)]">Required: {source.fields.filter((item) => item.required).map((item) => item.key).join(", ")}</p></div>{(parsedFile || error) && <Button type="button" variant="ghost" size="sm" onClick={() => resetImport()}><RefreshCw size={15} aria-hidden="true" />Start over</Button>}</div><div className="px-4 pt-4 sm:px-5"><WorkflowProgress currentStep={currentStep} /></div><div className="p-4 sm:p-5">{error && <div className="mb-4 flex items-start gap-3 rounded-[var(--radius-control-lg)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]" role="alert"><CircleAlert className="mt-0.5 shrink-0" size={17} /><span>{error}</span></div>}{!parsedFile ? <FileDropzone busy={reading} onFile={handleFile} /> : <div className="space-y-5"><PreviewTable file={parsedFile} />{validation && <ValidationPanel summary={validation} />}{importStatus === "success" && <div className="flex items-start gap-3 rounded-[var(--radius-control-lg)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success)]" role="status"><CheckCircle2 className="mt-0.5 shrink-0" size={17} /><span>Import recorded and the Data Hub dashboard is up to date for this session.</span></div>}<div className="flex flex-col gap-3 border-t border-[var(--divider)] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-xs leading-5 text-[var(--text-tertiary)]">Database persistence and rollback will connect through the prepared import service boundary in a future phase.</p>{!validation ? <Button type="button" onClick={validateFile}><ShieldCheck size={17} aria-hidden="true" />Validate file</Button> : validation.canImport && !approved ? <Button type="button" onClick={approveImport}><Check size={17} aria-hidden="true" />Approve import</Button> : validation.canImport && importStatus !== "success" ? <Button type="button" onClick={importFile} disabled={importing}>{importing ? <RefreshCw className="animate-spin" size={17} aria-hidden="true" /> : <Database size={17} aria-hidden="true" />}Import approved data</Button> : importStatus === "success" ? <Button type="button" variant="outline" onClick={() => resetImport()}>Import another file <ArrowRight size={16} aria-hidden="true" /></Button> : <Button type="button" variant="outline" onClick={() => resetImport()}>Choose corrected file</Button>}</div></div>}</div></Card>
    <Card className="overflow-hidden rounded-[var(--radius-card)] border-[var(--border-default)] shadow-[var(--shadow-card)]"><div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-5 py-4"><div><h2 className="text-lg font-semibold text-[var(--text-primary)]">Import history</h2><p className="mt-0.5 text-xs text-[var(--text-secondary)]">Current session activity with rollback readiness.</p></div><History className="text-[var(--text-tertiary)]" size={19} aria-hidden="true" /></div><ImportHistoryTable history={history} /></Card>
    </>}
  </div></main></div>;
}
