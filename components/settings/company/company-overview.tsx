import {
  Building2,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Coins,
  Globe2,
  Landmark,
  Network,
  ShieldCheck,
} from "lucide-react";
import type {
  CompanySettingsSnapshot,
  WorkflowStatus,
} from "../../../lib/company-management/types";
import { Progress } from "../../ui/progress";
import { CompanySectionCard } from "./company-form-controls";

export function CompanyOverview({
  snapshot,
  workflowStatus,
  lastPublishedAt,
}: {
  snapshot: CompanySettingsSnapshot;
  workflowStatus: WorkflowStatus;
  lastPublishedAt: string | null;
}) {
  const checklist = [
    {
      label: "Company Profile",
      complete: Boolean(
        snapshot.company.companyName &&
          snapshot.company.companyCode &&
          snapshot.company.email,
      ),
    },
    { label: "Branch", complete: snapshot.branches.length > 0 },
    { label: "Currency", complete: Boolean(snapshot.currency.primaryCurrency) },
    {
      label: "Language",
      complete: Boolean(snapshot.localization.defaultLanguage),
    },
    {
      label: "Fiscal Year",
      complete: Boolean(snapshot.fiscalYear.fiscalYearName),
    },
    {
      label: "Time Zone",
      complete: Boolean(snapshot.localization.defaultTimeZone),
    },
  ];
  const completion = Math.round(
    (checklist.filter((item) => item.complete).length / checklist.length) * 100,
  );
  const summaries = [
    {
      label: "Company Status",
      value: snapshot.company.status === "active" ? "Active" : "Disabled",
      icon: ShieldCheck,
    },
    {
      label: "Number of Branches",
      value: String(snapshot.branches.length),
      icon: Landmark,
    },
    {
      label: "Number of Departments",
      value: String(snapshot.departments.length),
      icon: Network,
    },
    {
      label: "Primary Currency",
      value: snapshot.currency.primaryCurrency,
      icon: Coins,
    },
    {
      label: "Default Language",
      value: languageName(snapshot.localization.defaultLanguage),
      icon: Globe2,
    },
    {
      label: "Fiscal Year",
      value: snapshot.fiscalYear.fiscalYearName,
      icon: CalendarDays,
    },
    {
      label: "Time Zone",
      value: snapshot.localization.defaultTimeZone,
      icon: Clock3,
    },
    {
      label: "Last Published",
      value: lastPublishedAt
        ? new Date(lastPublishedAt).toLocaleDateString()
        : "Not published",
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text-tertiary)]">
                    {item.label}
                  </p>
                  <p className="mt-2 truncate text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                    {item.value}
                  </p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                  <Icon size={19} aria-hidden="true" />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <CompanySectionCard
        title={`Company Setup ${completion}% Complete`}
        description={`Current workspace status: ${workflowStatus === "draft" ? "Draft" : "Published"}`}
      >
        <Progress value={completion} />
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {checklist.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-3 rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] px-3 py-3"
            >
              <span
                className={
                  item.complete
                    ? "grid size-6 place-items-center rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)]"
                    : "grid size-6 place-items-center rounded-full text-[var(--text-disabled)]"
                }
              >
                {item.complete ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Circle size={14} aria-hidden="true" />
                )}
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </CompanySectionCard>
    </div>
  );
}

function languageName(code: "th" | "en" | "my") {
  return { th: "Thai", en: "English", my: "Myanmar" }[code];
}
