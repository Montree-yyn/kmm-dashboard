import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card } from "../ui/card";

export type KpiTrendDirection = "up" | "down" | "neutral";
export type KpiStatus = "positive" | "warning" | "negative" | "neutral";
type LegacyComparisonDirection = "positive" | "negative" | "neutral";

export type KpiCardProps = {
  title: string;
  value: ReactNode;
  unit?: string;
  subtitle?: string;
  trendValue?: string;
  trendDirection?: KpiTrendDirection;
  comparisonLabel?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  status?: KpiStatus;
  loading?: boolean;
  empty?: boolean;
  className?: string;
  variant?: "executive" | "legacy";
  supportingText?: ReactNode;
  comparison?: {
    value: string;
    direction: LegacyComparisonDirection;
    label: string;
  };
};

const statusTone: Record<KpiStatus, string> = {
  positive: "text-[var(--status-success)]",
  warning: "text-[var(--status-warning)]",
  negative: "text-[var(--status-danger)]",
  neutral: "text-[var(--text-secondary)]",
};

const trendIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus,
};

const legacyComparisonTone: Record<LegacyComparisonDirection, string> = {
  positive: "text-[#16A34A]",
  negative: "text-[#DC2626]",
  neutral: "text-[#6B7280]",
};

function LegacyKpiCard({
  title,
  value,
  unit = "",
  comparison,
  supportingText,
  loading = false,
  empty = false,
  className,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        "h-full min-h-[168px] rounded-2xl border-[#E8EAED] bg-white p-4 shadow-[0_8px_24px_rgba(31,41,55,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(31,41,55,0.07)] 2xl:p-5",
        className,
      )}
    >
      <div className="flex h-full min-h-[136px] flex-col">
        <div className="min-h-10">
          <p className="max-h-10 overflow-hidden text-[15px] font-semibold leading-5 text-[#4B5563]">
            {title}
          </p>
        </div>
        <div className="flex min-h-12 flex-1 items-center">
          {loading ? (
            <div
              className="h-10 w-28 animate-pulse rounded-lg bg-[#E9EBEE]"
              aria-label={`Loading ${title}`}
            />
          ) : empty ? (
            <strong className="text-[20px] font-semibold leading-none text-[#9CA3AF]">
              No data available
            </strong>
          ) : (
            <div className="flex min-w-0 items-baseline gap-2">
              <strong className="shrink-0 text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#1F2937]">
                {value}
              </strong>
              {unit && (
                <span className="whitespace-nowrap text-sm font-semibold leading-none text-[#6B7280]">
                  {unit}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="min-h-11 text-xs font-medium leading-4 text-[#9CA3AF]">
          {comparison ? (
            <>
              <p
                className={cn(
                  "text-sm font-bold leading-4",
                  legacyComparisonTone[comparison.direction],
                )}
              >
                {comparison.value}
              </p>
              <p className="mt-1 line-clamp-2">{comparison.label}</p>
            </>
          ) : supportingText ? (
            <div className="line-clamp-2 pt-0.5">{supportingText}</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function KpiCard({
  title,
  value,
  unit,
  subtitle,
  trendValue,
  trendDirection = "neutral",
  comparisonLabel,
  icon,
  footer,
  status = "neutral",
  loading = false,
  empty = false,
  className,
  variant = "legacy",
  supportingText,
  comparison,
}: KpiCardProps) {
  if (variant === "legacy") {
    return (
      <LegacyKpiCard
        title={title}
        value={value}
        unit={unit}
        comparison={comparison}
        supportingText={supportingText}
        loading={loading}
        empty={empty}
        className={className}
      />
    );
  }

  const TrendIcon = trendIcon[trendDirection];
  const hasTrend = Boolean(trendValue);

  return (
    <Card
      className={cn(
        "group relative h-[160px] min-h-[160px] overflow-hidden rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--text-disabled)] hover:shadow-[var(--shadow-hover)] @container/kpi",
        className,
      )}
      data-kpi-card="true"
      data-kpi-status={status}
      aria-busy={loading || undefined}
    >
      <span
        className="absolute inset-x-0 top-0 h-[3px] bg-[var(--brand-500)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden="true"
      />
      <div className="grid h-full grid-rows-[24px_48px_40px_14px]">
        <div
          className="flex min-w-0 items-start justify-between gap-2 overflow-hidden"
          data-kpi-zone="header"
        >
          <p className="line-clamp-2 min-w-0 text-sm font-semibold leading-5 text-[var(--text-secondary)]">
            {title}
          </p>
          {icon && (
            <span
              className="grid size-5 shrink-0 place-items-center text-[var(--text-tertiary)]"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
        </div>

        <div
          className="flex min-w-0 flex-nowrap items-baseline gap-2 overflow-hidden @max-[167px]/kpi:gap-1"
          data-kpi-zone="value"
        >
          {loading ? (
            <span
              className="h-8 w-28 animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-muted)]"
              aria-label={`Loading ${title}`}
            />
          ) : empty ? (
            <strong className="whitespace-nowrap text-xl font-semibold leading-[40px] text-[var(--text-tertiary)]">
              No data available
            </strong>
          ) : (
            <>
              <strong className="kmm-tabular whitespace-nowrap text-[32px] font-semibold leading-[40px] tracking-normal text-[var(--text-primary)] @max-[167px]/kpi:text-[26px] 2xl:text-[34px]">
                {value}
              </strong>
              {unit && (
                <span className="whitespace-nowrap text-xs font-medium leading-4 text-[var(--text-secondary)] @max-[167px]/kpi:text-[11px]">
                  {unit}
                </span>
              )}
            </>
          )}
        </div>

        <div
          className="overflow-hidden text-xs font-normal leading-5 text-[var(--text-tertiary)]"
          data-kpi-zone="context"
        >
          {hasTrend ? (
            <>
              <p
                className={cn(
                  "kmm-tabular flex items-center gap-1 text-sm font-semibold leading-5",
                  statusTone[status],
                )}
              >
                <TrendIcon size={14} aria-hidden="true" />
                {trendValue}
              </p>
              {comparisonLabel && <p>{comparisonLabel}</p>}
            </>
          ) : subtitle ? (
            <p
              className={cn(
                "line-clamp-2",
                status !== "neutral" && statusTone[status],
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          className="overflow-hidden text-[11px] leading-[14px] text-[var(--text-tertiary)]"
          data-kpi-zone="footer"
        >
          {footer}
        </div>
      </div>
    </Card>
  );
}
