"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Save,
  Send,
  UploadCloud,
} from "lucide-react";
import {
  defaultDailyManagementInput,
  loadDailyManagementDraft,
  publishDailyManagementInput,
  saveDailyManagementDraft,
  type DailyManagementInputSnapshot,
} from "../../lib/daily-management/input-storage";
import { parseDailyManagementWorkbook } from "../../lib/daily-management/parse-input-workbook";
import { Card } from "../ui/card";

const inputClass = "h-10 w-full min-w-0 rounded-[10px] border border-[var(--border-default)] bg-white px-3 text-[11px] outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]";
const textareaClass = `${inputClass} min-h-20 resize-y py-2 leading-4`;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1 block text-[9px] font-semibold text-[var(--text-secondary)]">{label}</span>{children}</label>;
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function DailyManagementInputPage() {
  const [draft, setDraft] = useState<DailyManagementInputSnapshot>(() => structuredClone(defaultDailyManagementInput));
  const [savedDraft, setSavedDraft] = useState<DailyManagementInputSnapshot>(() => structuredClone(defaultDailyManagementInput));
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importCounts, setImportCounts] = useState<{ actions: number; notes: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = loadDailyManagementDraft();
      setDraft(stored);
      setSavedDraft(structuredClone(stored));
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedDraft), [draft, savedDraft]);
  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!draft.reportDate) errors.push("เลือก Report date");
    if (!draft.preparedBy.trim()) errors.push("ระบุ Prepared by");
    if (draft.bookingLifecycle.cancelUnits > 0 && !draft.bookingLifecycle.cancelReason.trim()) errors.push("ระบุ Cancel reason");
    draft.actions.forEach((action, index) => {
      if (!action.title.trim() || !action.owner.trim()) errors.push(`Action ${index + 1} ยังไม่ครบ`);
    });
    return errors;
  }, [draft]);

  function patch(patchValue: Partial<DailyManagementInputSnapshot>) {
    setDraft((current) => ({ ...current, ...patchValue }));
    setMessage("");
  }

  function patchAction(index: number, key: "title" | "detail" | "owner" | "nextStep", value: string) {
    setDraft((current) => ({ ...current, actions: current.actions.map((action, actionIndex) => actionIndex === index ? { ...action, [key]: value } : action) }));
    setMessage("");
  }

  async function importWorkbook(file: File) {
    setUploading(true);
    setMessage("");
    try {
      const result = await parseDailyManagementWorkbook(file, draft);
      setDraft(result.snapshot);
      setFileName(file.name);
      setImportCounts({ actions: result.counts.actions, notes: result.counts.notes });
      setMessage("นำเข้าข้อมูลแล้ว · ตรวจ Preview ก่อน Publish");
    } catch (error) {
      setFileName("");
      setImportCounts(null);
      setMessage(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void importWorkbook(file);
  }

  function saveDraft() {
    const saved = saveDailyManagementDraft(draft);
    setDraft(saved);
    setSavedDraft(structuredClone(saved));
    setMessage("บันทึก Draft แล้ว");
  }

  function publishPreview() {
    if (validation.length) return setMessage(validation[0]);
    const published = publishDailyManagementInput(draft);
    setDraft(published);
    setSavedDraft(structuredClone(published));
    setMessage("อัปเดต Daily Report Preview แล้ว");
  }

  const noteCount = lines(draft.notes.situation).length + lines(draft.notes.decision).length + lines(draft.notes.tomorrowFocus).length;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F5F6F8] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1460px] p-4 sm:p-5 xl:p-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><Link href="/daily-management" className="inline-flex min-h-9 items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--brand-600)]"><ArrowLeft size={14} />Daily Report</Link><h1 className="mt-1 text-[26px] font-semibold tracking-[-0.025em]">Update Daily Management</h1><p className="mt-1 text-[11px] text-[var(--text-secondary)]">Excel-first workflow · อัปโหลด ตรวจสอบ แล้ว Publish</p></div>
          <Link href="/data-hub" className="inline-flex min-h-10 items-center gap-2 self-start rounded-[10px] border border-[var(--border-default)] bg-white px-3 text-[10px] font-semibold text-[var(--text-secondary)] lg:self-auto"><Database size={14} />Sales · Booking · Stock Data Hub</Link>
        </header>

        <Card className="mt-4 overflow-hidden border-0 shadow-[0_14px_38px_rgba(27,31,42,0.09)]">
          <div className="grid bg-[#202124] text-white lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="border-white/10 p-5 lg:border-r">
              <p className="text-[11px] font-semibold">3 steps to update</p>
              <ol className="mt-5 space-y-5">
                {["Download template", "Drop Excel file", "Review & publish"].map((step, index) => <li key={step} className="flex items-center gap-3"><span className={`grid size-7 place-items-center rounded-full text-[10px] font-bold ${index === 1 && !fileName ? "bg-[var(--brand-500)] text-white" : fileName || index === 0 ? "bg-white text-[#202124]" : "bg-white/10 text-white/60"}`}>{fileName && index < 2 ? <Check size={13} /> : index + 1}</span><span className={`text-[10px] font-medium ${index === 1 && !fileName ? "text-white" : "text-white/65"}`}>{step}</span></li>)}
              </ol>
              <a href="/KMM_Daily_Management_Input_Template.xlsx" download className="mt-6 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-white px-3 text-[10px] font-bold text-[#202124] transition hover:bg-[#FFF1E6]"><Download size={14} />Download Excel Template</a>
            </div>

            <div className="p-4 sm:p-5">
              <input ref={fileInput} type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkbook(file); event.target.value = ""; }} />
              <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`flex min-h-44 flex-col items-center justify-center rounded-[14px] border border-dashed p-6 text-center transition ${dragging ? "border-[var(--brand-400)] bg-[#3A2A1F]" : fileName ? "border-[#4B7C5B] bg-[#24372A]" : "border-white/25 bg-white/[0.04]"}`}>
                <span className={`grid size-11 place-items-center rounded-[13px] ${fileName ? "bg-[#DFF4E5] text-[#267145]" : "bg-white/10 text-white"}`}>{uploading ? <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : fileName ? <FileSpreadsheet size={20} /> : <UploadCloud size={21} />}</span>
                <strong className="mt-3 text-[13px]">{uploading ? "Reading workbook…" : fileName || "Drop Excel file here"}</strong>
                <span className="mt-1 text-[9px] text-white/55">{fileName ? `${importCounts?.actions ?? 0} actions · ${importCounts?.notes ?? 0} notes imported` : ".xlsx or .xls · maximum 10 MB"}</span>
                <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="mt-3 min-h-9 rounded-[9px] border border-white/20 px-4 text-[10px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50">{fileName ? "Replace file" : "Choose file"}</button>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Imported data preview">
            {[{ label: "Report date", value: draft.reportDate }, { label: "Scope", value: draft.branch }, { label: "Actions", value: String(draft.actions.length) }, { label: "Note items", value: String(noteCount) }].map((item) => <div key={item.label} className="min-w-0 bg-white px-4 py-3"><span className="block text-[8px] font-bold uppercase tracking-[0.05em] text-[var(--text-tertiary)]">{item.label}</span><strong className="mt-1 block break-words text-[11px]">{item.value || "—"}</strong></div>)}
          </div>
        </Card>

        <details className="group mt-3 overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[11px] font-semibold marker:hidden"><span>Manual adjustments <span className="ml-2 font-normal text-[var(--text-tertiary)]">ใช้เมื่อแก้ข้อมูลเล็กน้อยหลัง Import</span></span><ChevronDown size={15} className="transition group-open:rotate-180" /></summary>
          <div className="border-t border-[var(--divider)] p-4">
            <section><h2 className="text-[11px] font-semibold">Report & lifecycle</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Report date"><input type="date" value={draft.reportDate} onChange={(event) => patch({ reportDate: event.target.value })} className={inputClass} /></Field><Field label="Branch"><select value={draft.branch} onChange={(event) => patch({ branch: event.target.value })} className={inputClass}><option>All Branches</option><option>KMM01 · Hpa-an</option><option>KMM02 · Mawlamyine</option><option>KMM03 · Tharyarwaddy</option></select></Field><Field label="Prepared by"><input value={draft.preparedBy} onChange={(event) => patch({ preparedBy: event.target.value })} className={inputClass} /></Field><Field label="MTD Target"><input type="number" min="0" value={draft.target.mtdTarget} onChange={(event) => patch({ target: { ...draft.target, mtdTarget: Number(event.target.value) } })} className={inputClass} /></Field><Field label="Expected Pace"><input type="number" min="0" value={draft.target.expectedPace} onChange={(event) => patch({ target: { ...draft.target, expectedPace: Number(event.target.value) } })} className={inputClass} /></Field><Field label="Wait Approve"><input type="number" min="0" value={draft.bookingLifecycle.waitApprove} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, waitApprove: Number(event.target.value) } })} className={inputClass} /></Field><Field label="Wait Delivery"><input type="number" min="0" value={draft.bookingLifecycle.waitDelivery} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, waitDelivery: Number(event.target.value) } })} className={inputClass} /></Field><Field label="Delivered Today"><input type="number" min="0" value={draft.bookingLifecycle.deliveredToday} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, deliveredToday: Number(event.target.value) } })} className={inputClass} /></Field><Field label="Cancel Units"><input type="number" min="0" value={draft.bookingLifecycle.cancelUnits} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, cancelUnits: Number(event.target.value) } })} className={inputClass} /></Field><Field label="Cancel Reason"><input value={draft.bookingLifecycle.cancelReason} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, cancelReason: event.target.value } })} className={inputClass} /></Field></div></section>

            <section className="mt-5 border-t border-[var(--divider)] pt-4"><h2 className="text-[11px] font-semibold">Actions</h2><div className="mt-2 space-y-2">{draft.actions.map((action, index) => <div key={index} className="grid gap-2 lg:grid-cols-[24px_1.3fr_1fr_140px_120px]"><span className="grid size-6 place-items-center self-end rounded-full bg-[#FFF0E4] text-[8px] font-bold text-[#B94D00]">{index + 1}</span><Field label="Issue"><input value={action.title} onChange={(event) => patchAction(index, "title", event.target.value)} className={inputClass} /></Field><Field label="Detail"><input value={action.detail} onChange={(event) => patchAction(index, "detail", event.target.value)} className={inputClass} /></Field><Field label="Owner"><input value={action.owner} onChange={(event) => patchAction(index, "owner", event.target.value)} className={inputClass} /></Field><Field label="Next step"><input value={action.nextStep} onChange={(event) => patchAction(index, "nextStep", event.target.value)} className={inputClass} /></Field></div>)}</div></section>

            <section className="mt-5 border-t border-[var(--divider)] pt-4"><h2 className="text-[11px] font-semibold">Management notes</h2><div className="mt-3 grid gap-3 lg:grid-cols-3"><Field label="Situation"><textarea value={draft.notes.situation} onChange={(event) => patch({ notes: { ...draft.notes, situation: event.target.value } })} className={textareaClass} /></Field><Field label="Decision"><textarea value={draft.notes.decision} onChange={(event) => patch({ notes: { ...draft.notes, decision: event.target.value } })} className={textareaClass} /></Field><Field label="Tomorrow Focus"><textarea value={draft.notes.tomorrowFocus} onChange={(event) => patch({ notes: { ...draft.notes, tomorrowFocus: event.target.value } })} className={textareaClass} /></Field></div></section>
          </div>
        </details>

        <div className="sticky bottom-0 z-20 mt-3 flex flex-col gap-3 rounded-[14px] border border-[var(--border-default)] bg-white/95 p-3 shadow-[0_12px_32px_rgba(27,31,42,0.14)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-[10px] font-semibold">{validation.length ? `${validation.length} issue${validation.length > 1 ? "s" : ""} to fix` : dirty ? "Ready to save" : "Draft saved"}</p><p aria-live="polite" className={`mt-0.5 text-[9px] ${message && validation.length ? "text-[var(--status-danger)]" : "text-[var(--text-secondary)]"}`}>{message || (validation[0] ?? "Changes remain local until Publish Preview")}</p></div>
          <div className="flex gap-2"><button type="button" disabled={!dirty || !ready} onClick={() => setDraft(structuredClone(savedDraft))} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[var(--border-default)] px-3 text-[10px] font-semibold disabled:opacity-40"><RotateCcw size={13} />Reset</button><button type="button" disabled={!dirty || !ready} onClick={saveDraft} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[var(--brand-500)] bg-[var(--brand-50)] px-3 text-[10px] font-semibold text-[var(--brand-600)] disabled:opacity-40"><Save size={13} />Save Draft</button><button type="button" disabled={!ready || validation.length > 0} onClick={publishPreview} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[var(--brand-500)] px-4 text-[10px] font-semibold text-white shadow-[0_6px_16px_rgba(245,102,0,0.2)] disabled:opacity-40"><Send size={13} />Publish Preview</button></div>
        </div>
      </main>
    </div>
  );
}
