"use client";

import { BarChart3, LockKeyhole, ShieldCheck, Tractor } from "lucide-react";
import { EmptyState } from "../../../components/design-system/empty-state";
import { useLocale } from "../../../src/hooks/useLocale";
import { AGRICULTURE_OPPORTUNITY_MODEL_VERSION, AGRICULTURE_OPPORTUNITY_WEIGHTS } from "./agriculture.logic";
import { agricultureCopy } from "./agriculture.ui";
import type { AgricultureOverviewPayload } from "./agriculture.types";

export function AgricultureOpportunities({ overview }: { overview: AgricultureOverviewPayload }) {
  const { language } = useLocale();
  const copy = agricultureCopy(language);
  return (
    <div className="space-y-5" data-agriculture-opportunities>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#fff2e7] text-[var(--brand-600)]"><BarChart3 size={16} /></span><h2 className="text-[20px] font-semibold">{copy.opportunity.title}</h2></div><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{copy.opportunity.help}</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><RuleBadge icon={<ShieldCheck size={14} />} label={copy.opportunity.model} value={AGRICULTURE_OPPORTUNITY_MODEL_VERSION} /><RuleBadge icon={<LockKeyhole size={14} />} label={copy.opportunity.status} value={copy.opportunity.paused} /><RuleBadge icon={<Tractor size={14} />} label={copy.opportunity.records} value={overview.opportunities.length ? `${overview.opportunities.length} ${copy.opportunity.held}` : copy.common.noData} /></div></div>
        <div className="rounded-[var(--radius-card)] border border-[#e8edf2] bg-[#f7fafc] p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{copy.opportunity.defaultWeights}</p><div className="mt-4 space-y-3">{Object.entries(AGRICULTURE_OPPORTUNITY_WEIGHTS).map(([key, value]) => <div key={key} className="flex items-center justify-between gap-3 text-xs"><span className="text-[var(--text-secondary)]">{labelize(key, language)}</span><strong className="text-[var(--text-primary)]">{value}%</strong></div>)}</div></div>
      </section>
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]" aria-label={copy.opportunity.ranking}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-5 py-4 sm:px-6"><div><h2 className="text-[17px] font-semibold">{copy.opportunity.ranking}</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">{copy.opportunity.rankingHelp}</p></div><span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-tertiary)]">{copy.opportunity.paused}</span></div>
        <EmptyState title={copy.opportunity.pausedTitle} message={copy.opportunity.pausedMessage} className="min-h-[280px]" />
      </section>
    </div>
  );
}

function RuleBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3"><div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">{icon}<span className="text-[10px] font-semibold uppercase tracking-[0.08em]">{label}</span></div><p className="mt-2 truncate text-xs font-semibold text-[var(--text-primary)]">{value}</p></div>;
}

function labelize(value: string, language: import("../../../src/locales").Language) {
  if (language === "th") {
    return ({
      cropStageProximity: "ความใกล้ถึงระยะพืช",
      customerContractorFit: "ความเหมาะสมกับลูกค้า/ผู้รับเหมา",
      machineGap: "ช่องว่างด้านเครื่องจักร",
      cropImportance: "ความสำคัญของพืช",
      weatherSuitabilityOrRisk: "ความเหมาะสม/ความเสี่ยงจากอากาศ",
      salesBookingHistory: "ประวัติการขาย/การจอง",
    } as Record<string, string>)[value] ?? value;
  }
  return value.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`).replace(/^./, (letter) => letter.toUpperCase());
}
