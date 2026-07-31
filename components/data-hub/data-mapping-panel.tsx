"use client";

import { Check, CircleAlert, Save, Sparkles } from "lucide-react";
import type { ColumnMapping, MappingStatus } from "../../lib/data-hub/column-mapping";
import type { DataSourceDefinition, ParsedImportFile } from "../../lib/data-hub/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const statusMeta: Record<MappingStatus, { label: string; className: string }> = {
  mapped: { label: "Mapped", className: "bg-[var(--status-success-bg)] text-[var(--status-success)]" },
  warning: { label: "Warning", className: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]" },
  missing: { label: "Missing", className: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" },
  ignored: { label: "Ignored", className: "bg-[var(--surface-subtle)] text-[var(--text-secondary)]" },
};

export function DataMappingPanel({
  source,
  file,
  mappings,
  saved,
  onChange,
  onSave,
  onOpenImport,
}: {
  source: DataSourceDefinition;
  file: ParsedImportFile | null;
  mappings: ColumnMapping[];
  saved: boolean;
  onChange: (excelColumn: string, fieldKey: string | null) => void;
  onSave: () => void;
  onOpenImport: () => void;
}) {
  if (!file) {
    return (
      <div className="grid min-h-[300px] place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--brand-50)] text-[var(--brand-600)]"><Sparkles size={21} /></span>
          <h2 className="mt-4 text-base font-semibold text-[var(--text-primary)]">Detect a spreadsheet template</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Upload a {source.label} file to detect Excel columns and prepare a reusable mapping.</p>
          <Button type="button" className="mt-4" onClick={onOpenImport}>Open import</Button>
        </div>
      </div>
    );
  }

  const missing = mappings.filter((mapping) => mapping.status === "missing").length;
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]" aria-labelledby="data-mapping-title">
      <div className="flex flex-col gap-3 border-b border-[var(--divider)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 id="data-mapping-title" className="text-lg font-semibold text-[var(--text-primary)]">Data Mapping</h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{file.filename} · detected automatically for {source.label}</p>
        </div>
        <Button type="button" size="sm" onClick={onSave}>
          {saved ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
          {saved ? "Saved" : "Save mapping"}
        </Button>
      </div>
      {missing > 0 && <div className="mx-4 mt-4 flex items-center gap-2 rounded-[var(--radius-control-lg)] bg-[var(--status-danger-bg)] px-3 py-2.5 text-xs text-[var(--status-danger)] sm:mx-5"><CircleAlert size={15} aria-hidden="true" />{missing} required field{missing === 1 ? " is" : "s are"} still missing.</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead><tr className="border-b border-[var(--divider)] text-xs text-[var(--text-tertiary)]"><th className="px-5 py-3 font-semibold">Excel Column</th><th className="px-5 py-3 font-semibold">Mapped Field</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead>
          <tbody>{mappings.map((mapping) => {
            const meta = statusMeta[mapping.status];
            const editable = mapping.excelColumn !== "—";
            return <tr key={`${mapping.excelColumn}-${mapping.fieldKey ?? "ignored"}`} className="border-b border-[var(--divider)] last:border-0 hover:bg-[var(--surface-subtle)]"><td className="px-5 py-3 font-medium text-[var(--text-primary)]">{mapping.excelColumn}</td><td className="px-5 py-3">{editable ? <select aria-label={`Map ${mapping.excelColumn}`} value={mapping.fieldKey ?? ""} onChange={(event) => onChange(mapping.excelColumn, event.target.value || null)} className="min-h-10 min-w-48 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><option value="">Ignored</option>{source.fields.map((field) => <option key={field.key} value={field.key}>{field.key}</option>)}</select> : <span className="font-mono text-xs text-[var(--text-secondary)]">{mapping.fieldKey}</span>}</td><td className="px-5 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", meta.className)}>{meta.label}</span></td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}
