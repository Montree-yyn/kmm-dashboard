"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FilePenLine,
  Save,
  Send,
  ShieldCheck,
  Target,
  Tractor,
} from "lucide-react";
import {
  defaultDailyManagementInput,
  loadDailyManagementDraft,
  publishDailyManagementInput,
  saveDailyManagementDraft,
  type DailyManagementInputSnapshot,
} from "../../lib/daily-management/input-storage";
import { Card } from "../ui/card";

const inputClass = "h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]";
const textareaClass = "min-h-24 w-full resize-y rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2.5 text-sm leading-5 text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{label}</span>{children}{hint && <span className="mt-1.5 block text-[10px] leading-4 text-[var(--text-tertiary)]">{hint}</span>}</label>;
}

function FormSection({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-[var(--divider)] px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--brand-50)] text-[var(--brand-600)]">{icon}</span>
        <div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{description}</p></div>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

const sourceChannels = [
  { title: "Sales", description: "Transactions and MTD sales", icon: <BarChart3 size={18} />, href: "/data-hub", state: "Data Hub" },
  { title: "Booking", description: "Booking transactions and HOT status", icon: <ClipboardCheck size={18} />, href: "/data-hub", state: "Data Hub" },
  { title: "Stock", description: "Engine stock, value and aging", icon: <Tractor size={18} />, href: "/data-hub", state: "Data Hub" },
] as const;

function SourceChannels() {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-[var(--divider)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Input Channels</h2><p className="mt-0.5 text-xs text-[var(--text-secondary)]">เลือกช่องทางตามเจ้าของข้อมูล ไม่กรอกยอดธุรกรรมซ้ำในฟอร์มนี้</p></div><span className="text-[10px] font-semibold text-[var(--status-success)]">4 governed channels</span></div>
      <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-2 xl:grid-cols-4">
        {sourceChannels.map((channel) => <Link key={channel.title} href={channel.href} className="group flex min-h-24 items-start gap-3 bg-[var(--surface-default)] p-4 transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"><span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-muted)] text-[var(--text-secondary)] group-hover:text-[var(--brand-600)]">{channel.icon}</span><span className="min-w-0"><span className="block text-xs font-semibold">{channel.title}</span><span className="mt-1 block text-[10px] leading-4 text-[var(--text-tertiary)]">{channel.description}</span><span className="mt-2 block text-[10px] font-semibold text-[var(--brand-600)]">Open {channel.state} →</span></span></Link>)}
        <div className="flex min-h-24 items-start gap-3 bg-[#FFF8EE] p-4"><span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-[var(--brand-600)]"><FilePenLine size={18} /></span><span><span className="block text-xs font-semibold">Management Input</span><span className="mt-1 block text-[10px] leading-4 text-[#79522D]">Target, cancel, actions and daily notes</span><span className="mt-2 block text-[10px] font-semibold text-[var(--status-success)]">Current form</span></span></div>
      </div>
    </Card>
  );
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function DailyManagementInputPage() {
  const [draft, setDraft] = useState<DailyManagementInputSnapshot>(() => structuredClone(defaultDailyManagementInput));
  const [savedDraft, setSavedDraft] = useState<DailyManagementInputSnapshot>(() => structuredClone(defaultDailyManagementInput));
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

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
      if (!action.title.trim() || !action.owner.trim()) errors.push(`กรอก Action priority ${index + 1} ให้ครบ`);
    });
    return errors;
  }, [draft]);

  function patch(patchValue: Partial<DailyManagementInputSnapshot>) {
    setDraft((current) => ({ ...current, ...patchValue }));
    setMessage("");
  }

  function patchAction(index: number, key: keyof DailyManagementInputSnapshot["actions"][number], value: string) {
    setDraft((current) => ({ ...current, actions: current.actions.map((action, actionIndex) => actionIndex === index ? { ...action, [key]: value } : action) }));
    setMessage("");
  }

  function saveDraft() {
    const saved = saveDailyManagementDraft(draft);
    setDraft(saved);
    setSavedDraft(structuredClone(saved));
    setMessage("บันทึก Draft ในเครื่องนี้แล้ว");
  }

  function publishPreview() {
    if (validation.length) {
      setMessage(validation[0]);
      return;
    }
    const published = publishDailyManagementInput(draft);
    setDraft(published);
    setSavedDraft(structuredClone(published));
    setMessage("Publish เข้า Daily Report Preview แล้ว");
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1540px] p-4 sm:p-5 xl:p-6">
        <div className="space-y-4">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><Link href="/daily-management" className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowLeft size={15} />Back to Daily Report</Link><h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em]">Daily Management Inputs</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">กรอกเฉพาะข้อมูลบริหารที่ไม่มีใน Sales, Booking และ Stock Data Hub</p></div>
            <div className="flex items-center gap-2"><span className="rounded-[var(--radius-pill)] bg-[#FFF1DD] px-3 py-1.5 text-[10px] font-bold text-[#8B4600]">Local Prototype</span>{draft.publishedAt && <span className="text-[10px] text-[var(--text-tertiary)]">Published {new Date(draft.publishedAt).toLocaleString()}</span>}</div>
          </header>

          <SourceChannels />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <FormSection icon={<CalendarDays size={18} />} title="Report Scope" description="กำหนดวันที่ ขอบเขตสาขา และผู้จัดทำข้อมูลชุดนี้">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Report date"><input type="date" value={draft.reportDate} onChange={(event) => patch({ reportDate: event.target.value })} className={inputClass} /></Field>
                  <Field label="Branch"><select value={draft.branch} onChange={(event) => patch({ branch: event.target.value })} className={inputClass}><option>All Branches</option><option>KMM01 · Hpa-an</option><option>KMM02 · Mawlamyine</option><option>KMM03 · Tharyarwaddy</option></select></Field>
                  <Field label="Prepared by"><input value={draft.preparedBy} onChange={(event) => patch({ preparedBy: event.target.value })} className={inputClass} placeholder="Name or division" /></Field>
                </div>
              </FormSection>

              <FormSection icon={<Target size={18} />} title="Target & Booking Lifecycle" description="ข้อมูลควบคุมที่ใช้คำนวณ Pace และขั้นตอนหลังการจอง">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="MTD Target"><input type="number" min="0" value={draft.target.mtdTarget} onChange={(event) => patch({ target: { ...draft.target, mtdTarget: Number(event.target.value) } })} className={inputClass} /></Field>
                  <Field label="Expected Pace"><input type="number" min="0" value={draft.target.expectedPace} onChange={(event) => patch({ target: { ...draft.target, expectedPace: Number(event.target.value) } })} className={inputClass} /></Field>
                  <Field label="Wait Approve"><input type="number" min="0" value={draft.bookingLifecycle.waitApprove} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, waitApprove: Number(event.target.value) } })} className={inputClass} /></Field>
                  <Field label="Wait Delivery"><input type="number" min="0" value={draft.bookingLifecycle.waitDelivery} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, waitDelivery: Number(event.target.value) } })} className={inputClass} /></Field>
                  <Field label="Delivered Today"><input type="number" min="0" value={draft.bookingLifecycle.deliveredToday} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, deliveredToday: Number(event.target.value) } })} className={inputClass} /></Field>
                  <Field label="Cancel Units"><input type="number" min="0" value={draft.bookingLifecycle.cancelUnits} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, cancelUnits: Number(event.target.value) } })} className={inputClass} /></Field>
                  <Field label="Cancel reason" hint="Required when Cancel Units > 0"><input value={draft.bookingLifecycle.cancelReason} onChange={(event) => patch({ bookingLifecycle: { ...draft.bookingLifecycle, cancelReason: event.target.value } })} className={inputClass} placeholder="Reason" /></Field>
                </div>
              </FormSection>

              <FormSection icon={<ShieldCheck size={18} />} title="Action Required" description="Top priorities ที่ต้องมี Owner และ Next step ชัดเจน">
                <div className="space-y-3">
                  {draft.actions.map((action, index) => <fieldset key={index} className="rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3"><legend className="px-1 text-[10px] font-bold text-[var(--brand-600)]">PRIORITY {index + 1}</legend><div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_150px_130px]"><Field label="Issue"><input value={action.title} onChange={(event) => patchAction(index, "title", event.target.value)} className={inputClass} /></Field><Field label="Detail"><input value={action.detail} onChange={(event) => patchAction(index, "detail", event.target.value)} className={inputClass} /></Field><Field label="Owner"><input value={action.owner} onChange={(event) => patchAction(index, "owner", event.target.value)} className={inputClass} /></Field><Field label="Next step"><input value={action.nextStep} onChange={(event) => patchAction(index, "nextStep", event.target.value)} className={inputClass} /></Field></div></fieldset>)}
                </div>
              </FormSection>

              <FormSection icon={<FilePenLine size={18} />} title="Daily Management Note" description="หนึ่งบรรทัดต่อหนึ่งหัวข้อ ระบบจะแปลงเป็น bullet ในรายงาน">
                <div className="grid gap-4 lg:grid-cols-3">
                  <Field label="Today’s Situation"><textarea value={draft.notes.situation} onChange={(event) => patch({ notes: { ...draft.notes, situation: event.target.value } })} className={textareaClass} /></Field>
                  <Field label="Management Decision"><textarea value={draft.notes.decision} onChange={(event) => patch({ notes: { ...draft.notes, decision: event.target.value } })} className={textareaClass} /></Field>
                  <Field label="Tomorrow Focus"><textarea value={draft.notes.tomorrowFocus} onChange={(event) => patch({ notes: { ...draft.notes, tomorrowFocus: event.target.value } })} className={textareaClass} /></Field>
                </div>
              </FormSection>
            </div>

            <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
              <Card className="p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Publish Readiness</h2><span className={`size-2.5 rounded-full ${validation.length ? "bg-[var(--status-warning)]" : "bg-[var(--status-success)]"}`} /></div><dl className="mt-4 space-y-2.5 text-xs"><div className="flex justify-between"><dt className="text-[var(--text-secondary)]">Report date</dt><dd className="font-semibold">{draft.reportDate || "—"}</dd></div><div className="flex justify-between"><dt className="text-[var(--text-secondary)]">Scope</dt><dd className="max-w-36 truncate font-semibold">{draft.branch}</dd></div><div className="flex justify-between"><dt className="text-[var(--text-secondary)]">Actions</dt><dd className="font-semibold">{draft.actions.length}</dd></div><div className="flex justify-between"><dt className="text-[var(--text-secondary)]">Note items</dt><dd className="font-semibold">{lines(draft.notes.situation).length + lines(draft.notes.decision).length + lines(draft.notes.tomorrowFocus).length}</dd></div></dl>{validation.length ? <ul className="mt-4 space-y-1.5 rounded-[var(--radius-control)] bg-[var(--status-warning-bg)] p-3 text-[10px] text-[var(--status-warning)]">{validation.map((error) => <li key={error}>• {error}</li>)}</ul> : <p className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--status-success-bg)] p-3 text-[10px] font-semibold text-[var(--status-success)]"><CheckCircle2 size={14} />Ready to publish preview</p>}</Card>
              <Card className="p-4"><h2 className="text-sm font-semibold">Data Boundary</h2><p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">ฟอร์มนี้ไม่แก้ Sales, Booking หรือ Stock transactions และยังไม่เขียนเข้า Production database</p><Link href="/data-hub" className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-[var(--brand-600)]"><Database size={15} />Open Data Hub</Link></Card>
            </aside>
          </div>

          <div className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-3 shadow-[var(--shadow-overlay)] sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold">{dirty ? "Unsaved changes" : "Draft is saved"}</p><p aria-live="polite" className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{message || (ready ? "Save Draft before publishing" : "Loading draft...")}</p></div><div className="grid grid-cols-3 gap-2 sm:flex"><button type="button" disabled={!dirty || !ready} onClick={() => setDraft(structuredClone(savedDraft))} className="min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 text-xs font-semibold disabled:opacity-45">Reset</button><button type="button" disabled={!dirty || !ready} onClick={saveDraft} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control-lg)] border border-[var(--brand-500)] bg-[var(--brand-50)] px-3 text-xs font-semibold text-[var(--brand-600)] disabled:opacity-45"><Save size={15} />Save Draft</button><button type="button" disabled={!ready || validation.length > 0} onClick={publishPreview} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-xs font-semibold text-white disabled:opacity-45"><Send size={15} />Publish Preview</button></div></div>
        </div>
      </main>
    </div>
  );
}
