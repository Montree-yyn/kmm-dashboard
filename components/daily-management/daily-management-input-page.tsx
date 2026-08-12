"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  Database,
  Download,
  FileSpreadsheet,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { loadDailyManagementInput, persistDailyManagementInput } from "../../lib/daily-management/input-client";
import {
  createDefaultDailyManagementInput,
  loadDailyManagementDraft,
  publishDailyManagementInput,
  saveDailyManagementDraft,
  type DailyManagementInputSnapshot,
} from "../../lib/daily-management/input-storage";
import { parseDailyManagementWorkbook } from "../../lib/daily-management/parse-input-workbook";
import { useLocale } from "../../src/hooks/useLocale";
import { useCompany } from "../../src/hooks/useCompany";
import {
  ALL_BRANCHES,
  canonicalDailyBranch,
  isDailyManagementBranch,
} from "../../lib/daily-management/branch";
import { isValidIsoDate } from "../../lib/daily-management/date";

const inputClass = "h-11 w-full min-w-0 rounded-[12px] border border-[#D9DCE2] bg-white px-3.5 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[#9297A1] hover:border-[#BFC3CA] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[#F4F5F7] disabled:text-[var(--text-secondary)]";
const textareaClass = `${inputClass} min-h-28 resize-y py-3 leading-5`;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-[12px] font-semibold text-[var(--text-primary)]">
        {label}{hint && <span className="font-normal text-[10px] text-[var(--text-tertiary)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--divider)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><h2 className="text-[16px] font-semibold tracking-[-0.015em]">{title}</h2><p className="mt-0.5 text-[11px] leading-4 text-[var(--text-secondary)]">{description}</p></div>
      {action}
    </div>
  );
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function DailyManagementInputPage() {
  const { t } = useLocale();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const companyCode = selectedCompany?.code ?? "KMM";
  const companyBranches = selectedCompany?.branches ?? [];
  const defaultInput = createDefaultDailyManagementInput({
    companyCode,
    timeZone: selectedCompany?.timeZone,
  });
  const [draft, setDraft] = useState<DailyManagementInputSnapshot>(() => structuredClone(defaultInput));
  const [savedDraft, setSavedDraft] = useState<DailyManagementInputSnapshot>(() => structuredClone(defaultInput));
  const [hasRemoteRecord, setHasRemoteRecord] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "neutral" | "success" | "danger" }>({ text: "", tone: "neutral" });
  const [importError, setImportError] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [importCounts, setImportCounts] = useState<{ actions: number; notes: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const searchParams = new URLSearchParams(window.location.search);
    const requestedDate = searchParams.get("date") ?? "";
    const requestedBranch = canonicalDailyBranch(searchParams.get("branch"));
    const hasRequestedScope = isValidIsoDate(requestedDate) && isDailyManagementBranch(requestedBranch, companyBranches);
    const stored = loadDailyManagementDraft(companyId, {
      companyCode,
      timeZone: selectedCompany?.timeZone,
    });
    const scope = hasRequestedScope ? { date: requestedDate, branch: requestedBranch } : undefined;
    void loadDailyManagementInput("draft", { ...scope, companyId })
      .then(async (draftRemote) => {
        const publishedRemote = !draftRemote && scope
          ? await loadDailyManagementInput("published", { ...scope, companyId })
          : null;
        if (!active) return;
        const remote = draftRemote ?? publishedRemote;
        const resolved = remote ?? (scope
          ? { ...structuredClone(defaultInput), reportDate: requestedDate, branch: requestedBranch }
          : stored);
        setDraft(resolved);
        setSavedDraft(structuredClone(resolved));
        setHasRemoteRecord(Boolean(remote));
        setMessage({
          text: draftRemote
            ? "โหลด Draft ตามวันที่และสาขาจาก D1 แล้ว"
            : publishedRemote
              ? "โหลดรายงานที่ Publish แล้วสำหรับวันที่และสาขานี้"
              : scope
                ? "ยังไม่มีข้อมูลสำหรับวันที่และสาขานี้ เริ่ม Draft ใหม่"
                : "เริ่ม Draft ใหม่ ยังไม่ได้บันทึกลง D1",
          tone: "neutral",
        });
      })
      .catch((error) => {
        if (!active) return;
        setDraft(stored);
        setSavedDraft(structuredClone(stored));
        setHasRemoteRecord(false);
        setMessage({ text: error instanceof Error ? error.message : "เชื่อมต่อ D1 ไม่สำเร็จ", tone: "danger" });
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, [companyId]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedDraft), [draft, savedDraft]);
  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!draft.reportDate) errors.push("เลือกวันที่รายงาน");
    if (!draft.preparedBy.trim()) errors.push("ระบุผู้จัดทำ");
    draft.actions.forEach((action, index) => {
      if (!action.title.trim() || !action.owner.trim()) errors.push(`Action ${index + 1} ต้องมีหัวข้อและผู้รับผิดชอบ`);
    });
    return errors;
  }, [draft]);

  function clearMessage() {
    setMessage({ text: "", tone: "neutral" });
  }

  function patch(patchValue: Partial<DailyManagementInputSnapshot>) {
    setDraft((current) => ({ ...current, ...patchValue }));
    clearMessage();
  }

  function patchAction(index: number, key: "title" | "detail" | "owner" | "nextStep" | "priority", value: string) {
    setDraft((current) => ({
      ...current,
      actions: current.actions.map((action, actionIndex) => actionIndex === index ? { ...action, [key]: value } : action),
    }));
    clearMessage();
  }

  function addAction() {
    if (draft.actions.length >= 20) return setMessage({ text: "เพิ่มได้สูงสุด 20 Actions ต่อรายงาน", tone: "danger" });
    setDraft((current) => ({
      ...current,
      actions: [...current.actions, { title: "", detail: "", owner: "", nextStep: "Follow up", priority: "warning" }],
    }));
    clearMessage();
  }

  function removeAction(index: number) {
    setDraft((current) => ({ ...current, actions: current.actions.filter((_, actionIndex) => actionIndex !== index) }));
    clearMessage();
  }

  async function importWorkbook(file: File) {
    setUploading(true);
    clearMessage();
    setImportError("");
    try {
      const result = await parseDailyManagementWorkbook(file, draft);
      setDraft(result.snapshot);
      setFileName(file.name);
      setImportCounts({ actions: result.counts.actions, notes: result.counts.notes });
      setMessage({ text: "นำเข้าข้อมูลแล้ว กรุณาตรวจสอบก่อน Publish", tone: "success" });
    } catch (error) {
      setFileName("");
      setImportCounts(null);
      const errorMessage = error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ";
      setImportError(errorMessage);
      setMessage({ text: errorMessage, tone: "danger" });
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

  async function saveDraft() {
    if (validation.length) return setMessage({ text: validation[0], tone: "danger" });
    setSaving("draft");
    try {
      const remote = await persistDailyManagementInput(draft, "draft", companyId);
      const saved = saveDailyManagementDraft(remote, companyId);
      setDraft(saved);
      setSavedDraft(structuredClone(saved));
      setHasRemoteRecord(true);
      setMessage({ text: "บันทึก Draft ลง D1 แล้ว", tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "บันทึก Draft ไม่สำเร็จ", tone: "danger" });
    } finally {
      setSaving(null);
    }
  }

  async function publish() {
    if (validation.length) return setMessage({ text: validation[0], tone: "danger" });
    setSaving("publish");
    try {
      const remote = await persistDailyManagementInput(draft, "publish", companyId);
      const published = publishDailyManagementInput(remote, companyId);
      setDraft(published);
      setSavedDraft(structuredClone(published));
      setHasRemoteRecord(true);
      setMessage({ text: "Publish สำเร็จ รายงาน Daily Management อัปเดตแล้ว", tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Publish ไม่สำเร็จ", tone: "danger" });
    } finally {
      setSaving(null);
    }
  }

  const noteCount = lines(draft.notes.situation).length + lines(draft.notes.decision).length + lines(draft.notes.tomorrowFocus).length;
  const busy = saving !== null;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F5F6F8] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1180px] p-4 sm:p-5 xl:py-7">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/daily-management" className="inline-flex min-h-9 items-center gap-2 text-[12px] font-semibold text-[var(--text-secondary)] transition hover:text-[var(--brand-600)]"><ArrowLeft size={15} />{t("daily.back")}</Link>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.025em] sm:text-[32px]">{t("daily.input.title")}</h1>
            <p className="mt-1 max-w-[620px] text-[13px] leading-5 text-[var(--text-secondary)]">{t("daily.input.subtitle")}</p>
          </div>
          <Link href="/data-hub" className="inline-flex min-h-11 items-center gap-2 self-start rounded-[12px] border border-[var(--border-default)] bg-white px-4 text-[12px] font-semibold text-[var(--text-secondary)] transition hover:border-[#C8CBD1] hover:bg-[#FAFAFB] lg:self-auto"><Database size={16} />{t("daily.openDataHub")}</Link>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[#202124] px-4 py-3 text-white shadow-[0_12px_28px_rgba(27,31,42,0.12)]">
          <span className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[#35373B] text-[#FF8A38]"><Sparkles size={16} /></span><span><strong className="block text-[12px]">{t("daily.webForm")}</strong><span className="block text-[10px] text-white/70">{t("daily.webFormDescription")}</span></span></span>
          <span className="rounded-full bg-[#2C4734] px-3 py-1.5 text-[10px] font-semibold text-[#BFE6C9]">{dirty ? t("daily.unsaved") : hasRemoteRecord ? t("daily.synced") : t("daily.notSaved")}</span>
        </div>

        <form className="mt-4 space-y-4" onSubmit={(event) => event.preventDefault()}>
          <section className="overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-white shadow-[0_8px_24px_rgba(27,31,42,0.05)]">
            <SectionHeader title={t("daily.reportInfo")} description={t("daily.reportInfoDescription")} />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("daily.reportDate")}><input type="date" value={draft.reportDate} onChange={(event) => patch({ reportDate: event.target.value })} className={inputClass} /></Field>
              <Field label={t("daily.branch")}><select value={draft.branch} onChange={(event) => patch({ branch: event.target.value })} className={inputClass}><option value={ALL_BRANCHES}>{ALL_BRANCHES}</option>{companyBranches.map((branch) => <option key={branch.code} value={branch.code}>{branch.code} · {branch.name}</option>)}</select></Field>
              <Field label={t("daily.preparedBy")}><input value={draft.preparedBy} onChange={(event) => patch({ preparedBy: event.target.value })} className={inputClass} /></Field>
            </div>
            <div className="flex items-start gap-2 border-t border-[var(--divider)] bg-[#F8FAF9] px-5 py-3 text-[11px] leading-4 text-[#42604C]"><Check className="mt-0.5 shrink-0 text-[#2E7D47]" size={14} /><span>{t("daily.lifecycleAutomatic")}</span></div>
          </section>

          <section className="overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-white shadow-[0_8px_24px_rgba(27,31,42,0.05)]">
            <SectionHeader title={t("daily.actions")} description={t("daily.actionsDescription")} action={<button type="button" onClick={addAction} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[11px] border border-[#F3C29F] bg-[#FFF6EF] px-3.5 text-[11px] font-semibold text-[#A94700] transition hover:bg-[#FFECDD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Plus size={14} />{t("daily.addAction")}</button>} />
            {draft.actions.length ? (
              <div className="divide-y divide-[var(--divider)]">
                {draft.actions.map((action, index) => (
                  <div key={index} className="grid gap-3 px-5 py-4 lg:grid-cols-[110px_minmax(180px,1.3fr)_minmax(180px,1fr)_150px_140px_40px] lg:items-end">
                    <Field label={`${t("daily.priority")} ${index + 1}`}><select value={action.priority} onChange={(event) => patchAction(index, "priority", event.target.value)} className={inputClass}><option value="critical">Critical</option><option value="warning">Warning</option><option value="attention">Attention</option></select></Field>
                    <Field label={t("daily.issue")}><input value={action.title} onChange={(event) => patchAction(index, "title", event.target.value)} className={inputClass} /></Field>
                    <Field label={t("daily.detail")}><input value={action.detail} onChange={(event) => patchAction(index, "detail", event.target.value)} className={inputClass} /></Field>
                    <Field label={t("daily.owner")}><input value={action.owner} onChange={(event) => patchAction(index, "owner", event.target.value)} className={inputClass} /></Field>
                    <Field label={t("daily.nextStep")}><input value={action.nextStep} onChange={(event) => patchAction(index, "nextStep", event.target.value)} className={inputClass} /></Field>
                    <button type="button" onClick={() => removeAction(index)} aria-label={`Delete action ${index + 1}`} className="grid size-10 place-items-center rounded-[10px] text-[var(--text-tertiary)] transition hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-36 place-items-center px-5 py-8 text-center"><span><ListChecks className="mx-auto text-[#A8ACB4]" size={24} /><strong className="mt-2 block text-[13px]">{t("daily.noActions")}</strong><span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{t("daily.noActionsDescription")}</span></span></div>
            )}
          </section>

          <section className="overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-white shadow-[0_8px_24px_rgba(27,31,42,0.05)]">
            <SectionHeader title={t("daily.notes")} description={t("daily.notesDescription")} />
            <div className="grid gap-4 p-5 lg:grid-cols-3">
              <Field label={t("daily.situation")} hint={`${lines(draft.notes.situation).length} items`}><textarea value={draft.notes.situation} onChange={(event) => patch({ notes: { ...draft.notes, situation: event.target.value } })} className={textareaClass} /></Field>
              <Field label={t("daily.decision")} hint={`${lines(draft.notes.decision).length} items`}><textarea value={draft.notes.decision} onChange={(event) => patch({ notes: { ...draft.notes, decision: event.target.value } })} className={textareaClass} /></Field>
              <Field label={t("daily.tomorrow")} hint={`${lines(draft.notes.tomorrowFocus).length} items`}><textarea value={draft.notes.tomorrowFocus} onChange={(event) => patch({ notes: { ...draft.notes, tomorrowFocus: event.target.value } })} className={textareaClass} /></Field>
            </div>
          </section>
        </form>

        <details className="group mt-4 overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[12px] font-semibold marker:hidden"><span>{t("daily.importExcel")} <span className="ml-2 font-normal text-[var(--text-tertiary)]">{t("daily.excelAlternative")}</span></span><ChevronDown size={16} className="transition group-open:rotate-180" /></summary>
          <div className="grid gap-4 border-t border-[var(--divider)] p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div><p className="text-[11px] leading-4 text-[var(--text-secondary)]">{companyCode === "KMM" ? t("daily.templateOnly") : "KM Daily Management template is not approved yet. Use Data Hub for Sales, Booking and Stock onboarding."}</p>{companyCode === "KMM" && <a href="/api/daily-management/template" download="KMM_Daily_Management_Input_Template.xlsx" className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--border-default)] bg-white px-3 text-[11px] font-semibold transition hover:bg-[#FAFAFB]"><Download size={14} />{t("daily.downloadTemplate")}</a>}</div>
            <div>
              <input ref={fileInput} type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkbook(file); event.target.value = ""; }} />
              <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`flex min-h-32 flex-col items-center justify-center rounded-[12px] border border-dashed p-4 text-center transition ${dragging ? "border-[var(--brand-500)] bg-[#FFF7F1]" : fileName ? "border-[#89B597] bg-[#F5FBF7]" : importError ? "border-[#E4A5A0] bg-[#FFF7F6]" : "border-[#C9CCD2] bg-[#FAFAFB]"}`}>
                <span className={`grid size-9 place-items-center rounded-[10px] ${fileName ? "bg-[#DFF4E5] text-[#267145]" : "bg-[#ECEEF1] text-[#636872]"}`}>{uploading ? <span className="size-4 animate-spin rounded-full border-2 border-[#BABEC5] border-t-[#3F444D]" /> : fileName ? <FileSpreadsheet size={18} /> : <UploadCloud size={18} />}</span>
                <strong className="mt-2 text-[12px]">{uploading ? t("common.loading") : fileName || t("daily.dropExcel")}</strong>
                <span className="mt-1 text-[10px] text-[var(--text-tertiary)]">{fileName ? `${importCounts?.actions ?? 0} actions · ${importCounts?.notes ?? 0} notes` : ".xlsx or .xls · maximum 10 MB"}</span>
                <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="mt-2 min-h-9 rounded-[9px] border border-[var(--border-default)] bg-white px-3 text-[10px] font-semibold transition hover:bg-[#F6F7F8] disabled:opacity-50">{fileName ? t("daily.replaceFile") : t("daily.chooseFile")}</button>
              </div>
              {importError && <div className="mt-2 flex flex-col gap-2 rounded-[10px] bg-[var(--status-danger-bg)] px-3 py-2.5 text-[10px] text-[var(--status-danger)] sm:flex-row sm:items-center sm:justify-between" role="alert"><span className="flex min-w-0 items-start gap-2"><CircleAlert className="mt-0.5 shrink-0" size={14} /><span>{importError}</span></span>{/Data Hub/.test(importError) && <Link href="/data-hub" className="font-semibold underline underline-offset-2">Open Data Hub</Link>}</div>}
            </div>
          </div>
        </details>

        <div className="sticky bottom-0 z-20 mt-4 flex flex-col gap-3 rounded-[14px] border border-[var(--border-default)] bg-white/95 p-3.5 shadow-[0_14px_36px_rgba(27,31,42,0.14)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-[12px] font-semibold">{validation.length ? `${validation.length} รายการต้องแก้ไข` : dirty ? "พร้อมบันทึก" : hasRemoteRecord ? "ข้อมูลล่าสุดถูกบันทึกแล้ว" : "Draft ใหม่ ยังไม่ได้บันทึก"}</p><p aria-live="polite" className={`mt-0.5 text-[10px] ${message.tone === "danger" ? "text-[var(--status-danger)]" : message.tone === "success" ? "text-[var(--status-success)]" : "text-[var(--text-secondary)]"}`}>{message.text || validation[0] || `${draft.actions.length} actions · ${noteCount} notes`}</p></div>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <button type="button" disabled={!dirty || !ready || busy} onClick={() => setDraft(structuredClone(savedDraft))} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] border border-[var(--border-default)] px-3.5 text-[11px] font-semibold transition hover:bg-[#F7F8F9] disabled:opacity-40"><RotateCcw size={14} />{t("common.reset")}</button>
            <button type="button" disabled={!dirty || !ready || busy || validation.length > 0} onClick={() => void saveDraft()} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] border border-[#E8A575] bg-[#FFF6EF] px-4 text-[11px] font-semibold text-[#A94700] transition hover:bg-[#FFECDD] disabled:opacity-40"><Save size={14} />{saving === "draft" ? t("common.loading") : t("common.saveDraft")}</button>
            <button type="button" disabled={!ready || busy || validation.length > 0 || (!dirty && !hasRemoteRecord)} onClick={() => void publish()} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] bg-[var(--brand-500)] px-4 text-[11px] font-semibold text-white shadow-[0_7px_18px_rgba(245,102,0,0.22)] transition hover:bg-[var(--brand-600)] disabled:opacity-40"><Send size={14} />{saving === "publish" ? t("common.loading") : t("daily.publishReport")}</button>
          </div>
        </div>
      </main>
    </div>
  );
}
