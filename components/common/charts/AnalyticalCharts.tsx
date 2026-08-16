import { cn } from "../../../lib/utils";
import { chartTheme } from "./chartTheme";

export type StackedColumnSeries = {
  id: string;
  label: string;
  color: string;
  values: number[];
};

export type ComparisonDatum = {
  label: string;
  left: number;
  right: number;
};

export type HeatmapDatum = {
  label: string;
  values: number[];
};

export type HeatmapTone = "healthy" | "current" | "watch" | "critical";

export type RankedDatum = {
  label: string;
  value: number;
};

const formatNumber = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 1 });

const readableTextColor = (background: string) => {
  const hex = background.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return chartTheme.surface;
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  const luminance = (red * 299 + green * 587 + blue * 114) / 255000;
  return luminance > 0.58 ? chartTheme.ink : chartTheme.surface;
};

const hexToRgb = (hex: string) =>
  [0, 2, 4]
    .map((offset) => Number.parseInt(hex.slice(offset + 1, offset + 3), 16))
    .join(" ");

const HEATMAP_TONE_RGB: Record<HeatmapTone, string> = {
  healthy: hexToRgb(chartTheme.status.positive),
  current: hexToRgb(chartTheme.product.core),
  watch: hexToRgb(chartTheme.status.warning),
  critical: hexToRgb(chartTheme.status.negative),
};

function ChartLegend({
  items,
}: {
  items: { id: string; label: string; color: string; marker?: "line" | "dot" }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[var(--text-secondary)]">
      {items.map((item) => (
        <span key={item.id} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              item.marker === "line" ? "h-0.5 w-4" : "size-2.5 rounded-[3px]",
            )}
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function StackedColumnChart({
  labels,
  series,
  formatValue = formatNumber,
  unit = "records",
}: {
  labels: string[];
  series: StackedColumnSeries[];
  formatValue?: (value: number) => string;
  unit?: string;
}) {
  const totals = labels.map((_, index) =>
    series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0),
  );
  const max = Math.max(...totals, 1);
  const hasData = totals.some((value) => value > 0);

  if (!hasData) {
    return (
      <p className="grid min-h-64 place-items-center text-center text-sm text-[var(--text-tertiary)]">
        No lifecycle data is available for the selected scope.
      </p>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Monthly stacked columns showing ${series.map((item) => item.label).join(", ")}`}
    >
      <ChartLegend items={series} />
      <div
        className="mt-5 grid h-64 items-end gap-1.5 sm:gap-2.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(labels.length, 1)}, minmax(0, 1fr))` }}
      >
        {labels.map((label, index) => {
          const total = totals[index] ?? 0;
          return (
            <div key={`${label}-${index}`} className="flex h-full min-w-0 flex-col justify-end">
              <span className="kmm-tabular mb-1 hidden text-center text-[10px] font-semibold text-[var(--text-tertiary)] sm:block">
                {total ? formatValue(total) : ""}
              </span>
              <div
                className="flex min-h-1 w-full flex-col-reverse overflow-hidden rounded-t-[6px] bg-[var(--surface-muted)]"
                style={{ height: `${Math.max((total / max) * 100, total ? 3 : 0)}%` }}
                title={`${label}: ${formatValue(total)} ${unit}`}
              >
                {series.map((item) => {
                  const value = item.values[index] ?? 0;
                  return value > 0 ? (
                    <span
                      key={item.id}
                      style={{
                        height: `${(value / Math.max(total, 1)) * 100}%`,
                        backgroundColor: item.color,
                      }}
                      title={`${item.label}: ${formatValue(value)} ${unit}`}
                    />
                  ) : null;
                })}
              </div>
              <span
                className={cn(
                  "mt-2 truncate text-center text-[10px] font-medium text-[var(--text-tertiary)]",
                  index % 2 === 1 && "max-sm:sr-only",
                )}
                title={label}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="sr-only">
        {labels
          .map(
            (label, index) =>
              `${label}: ${series
                .map((item) => `${item.label} ${formatValue(item.values[index] ?? 0)}`)
                .join(", ")}.`,
          )
          .join(" ")}
      </p>
    </div>
  );
}

export function PairedBarChart({
  items,
  leftLabel,
  rightLabel,
  leftShortLabel = leftLabel,
  rightShortLabel = rightLabel,
  leftColor = chartTheme.previous,
  rightColor = chartTheme.current,
  shortageLabel = "Shortage",
  surplusLabel = "Surplus",
  balancedLabel = "Balanced",
  semanticGapColors = false,
  limit = 10,
  formatValue = formatNumber,
}: {
  items: ComparisonDatum[];
  leftLabel: string;
  rightLabel: string;
  leftShortLabel?: string;
  rightShortLabel?: string;
  leftColor?: string;
  rightColor?: string;
  shortageLabel?: string;
  surplusLabel?: string;
  balancedLabel?: string;
  semanticGapColors?: boolean;
  limit?: number;
  formatValue?: (value: number) => string;
}) {
  const visible = items.slice(0, limit);
  const max = Math.max(...visible.flatMap((item) => [item.left, item.right]), 1);

  if (!visible.length) {
    return (
      <p className="grid min-h-56 place-items-center text-center text-sm text-[var(--text-tertiary)]">
        No comparable data is available for the selected scope.
      </p>
    );
  }

  return (
    <div role="img" aria-label={`${leftLabel} compared with ${rightLabel} by category using paired bars`}>
      <ChartLegend
        items={[
          { id: "left", label: leftLabel, color: leftColor },
          { id: "right", label: rightLabel, color: rightColor },
        ]}
      />
      <div className="mt-5 divide-y divide-[var(--divider)]">
        {visible.map((item) => {
          const leftWidth = (item.left / max) * 100;
          const rightWidth = (item.right / max) * 100;
          const difference = item.right - item.left;
          const gapLabel = difference < 0
            ? `${shortageLabel} ${formatValue(Math.abs(difference))}`
            : difference > 0
              ? `${surplusLabel} ${formatValue(difference)}`
              : balancedLabel;
          return (
            <div
              key={item.label}
              className="grid gap-3 py-4 sm:grid-cols-[minmax(120px,0.8fr)_minmax(220px,2.2fr)_minmax(96px,0.62fr)] sm:items-center sm:gap-4"
              aria-label={`${item.label}: ${leftLabel} ${formatValue(item.left)}, ${rightLabel} ${formatValue(item.right)}, ${gapLabel}`}
            >
              <span className="min-w-0 truncate text-xs font-semibold text-[var(--text-primary)]" title={item.label}>
                {item.label}
              </span>
              <div className="space-y-2.5" aria-hidden="true">
                {[
                  { label: leftShortLabel, value: item.left, width: leftWidth, color: leftColor },
                  { label: rightShortLabel, value: item.right, width: rightWidth, color: rightColor },
                ].map((bar) => (
                  <div key={bar.label} className="grid grid-cols-[minmax(58px,auto)_minmax(0,1fr)_42px] items-center gap-2">
                    <span className="truncate text-[10px] font-medium text-[var(--text-tertiary)]" title={bar.label}>{bar.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-[4px] bg-[var(--surface-muted)]">
                      <i
                        className="block h-full rounded-[4px]"
                        style={{
                          width: `${bar.width}%`,
                          minWidth: bar.value > 0 ? "2px" : undefined,
                          backgroundColor: bar.color,
                        }}
                      />
                    </span>
                    <strong className="kmm-tabular text-right text-[11px] font-semibold text-[var(--text-primary)]">{formatValue(bar.value)}</strong>
                  </div>
                ))}
              </div>
              <span
                className={cn(
                  "kmm-tabular w-fit rounded-[var(--radius-control)] border px-2.5 py-1 text-[11px] font-semibold sm:ml-auto",
                  semanticGapColors
                    ? difference < 0
                      ? "border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)] text-[var(--status-danger)]"
                      : difference > 0
                        ? "border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                        : "border-[var(--status-success-bg)] bg-[var(--status-success-bg)] text-[var(--status-success)]"
                    : difference < 0
                      ? "border-[var(--brand-100)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
                )}
              >
                {gapLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PercentStackedBar({
  segments,
  formatValue = formatNumber,
}: {
  segments: { id: string; label: string; value: number; color: string }[];
  formatValue?: (value: number) => string;
}) {
  const visible = segments.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return (
      <p className="grid min-h-36 place-items-center text-center text-sm text-[var(--text-tertiary)]">
        No composition data is available for the selected scope.
      </p>
    );
  }

  return (
    <div role="img" aria-label={`Composition of ${formatValue(total)} total units`}>
      <div className="flex h-10 overflow-hidden rounded-[var(--radius-control-lg)] bg-[var(--surface-muted)]">
        {visible.map((item) => {
          const share = (item.value / total) * 100;
          return (
            <div
              key={item.id}
              className="grid min-w-0 place-items-center border-r border-white/70 last:border-r-0"
              style={{ width: `${share}%`, backgroundColor: item.color }}
              title={`${item.label}: ${formatValue(item.value)} (${share.toFixed(1)}%)`}
            >
              {share >= 11 && (
                <span
                  className="kmm-tabular px-1 text-[10px] font-semibold"
                  style={{ color: readableTextColor(item.color) }}
                >
                  {share.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {visible.map((item) => (
          <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
              <i className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="kmm-tabular shrink-0 font-semibold text-[var(--text-primary)]">
              {formatValue(item.value)} · {((item.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeatmapMatrix({
  columns,
  rows,
  limit = 10,
  criticalColumn = columns.length - 1,
  columnTones,
  formatValue = formatNumber,
  categoryLabel = "Category",
  lowerLabel = "Lower concentration",
  higherLabel = "Higher concentration",
}: {
  columns: string[];
  rows: HeatmapDatum[];
  limit?: number;
  criticalColumn?: number;
  columnTones?: HeatmapTone[];
  formatValue?: (value: number) => string;
  categoryLabel?: string;
  lowerLabel?: string;
  higherLabel?: string;
}) {
  const visible = rows.slice(0, limit);
  const max = Math.max(...visible.flatMap((row) => row.values), 1);

  if (!visible.length) {
    return (
      <p className="grid min-h-48 place-items-center text-center text-sm text-[var(--text-tertiary)]">
        No aging data is available for the selected scope.
      </p>
    );
  }

  return (
    <div role="img" aria-label={`Aging heatmap with columns ${columns.join(", ")}`}>
      <div className="mb-1 hidden grid-cols-[minmax(140px,1.3fr)_repeat(4,minmax(62px,1fr))] gap-1.5 px-1 text-[10px] font-semibold text-[var(--text-tertiary)] sm:grid">
        <span>{categoryLabel}</span>
        {columns.map((column, columnIndex) => {
          const tone = columnTones?.[columnIndex];
          return (
            <span key={column} className="inline-flex items-center justify-center gap-1.5 text-center">
              {tone && <i className="size-2 rounded-full" style={{ backgroundColor: `rgb(${HEATMAP_TONE_RGB[tone]})` }} aria-hidden="true" />}
              {column}
            </span>
          );
        })}
      </div>
      <div className="space-y-1.5">
        {visible.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-4 gap-1.5 sm:grid-cols-[minmax(140px,1.3fr)_repeat(4,minmax(62px,1fr))]"
          >
            <span className="col-span-4 min-w-0 truncate px-1 py-1.5 text-xs font-medium text-[var(--text-secondary)] sm:col-span-1" title={row.label}>
              {row.label}
            </span>
            {columns.map((column, columnIndex) => {
              const value = row.values[columnIndex] ?? 0;
              const strength = value > 0 ? 0.1 + Math.sqrt(value / max) * 0.72 : 0.035;
              const critical = columnIndex === criticalColumn;
              const tone = columnTones?.[columnIndex] ?? (critical ? "critical" : "current");
              const textColor = strength > 0.52 ? chartTheme.surface : "var(--text-primary)";
              return (
                <span
                  key={column}
                  className="kmm-tabular min-h-12 rounded-[var(--radius-control)] border border-black/[0.04] px-1.5 py-1.5 text-center text-xs font-semibold"
                  style={{
                    backgroundColor: `rgb(${HEATMAP_TONE_RGB[tone]} / ${strength})`,
                    color: textColor,
                  }}
                  title={`${row.label}, ${column}: ${formatValue(value)}`}
                >
                  <span className="mb-0.5 block text-[9px] font-medium opacity-70 sm:hidden">{column}</span>
                  {formatValue(value)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {!columnTones && (
        <div className="mt-4 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
          <span>{lowerLabel}</span>
          {[0.12, 0.28, 0.46, 0.7].map((opacity) => (
            <i key={opacity} className="h-2.5 flex-1 rounded-[3px]" style={{ backgroundColor: `rgb(${hexToRgb(chartTheme.product.core)} / ${opacity})` }} />
          ))}
          <span>{higherLabel}</span>
        </div>
      )}
    </div>
  );
}

export function LollipopChart({
  items,
  limit = 10,
  threshold,
  thresholdLabel,
  suffix = "",
  formatValue = formatNumber,
}: {
  items: RankedDatum[];
  limit?: number;
  threshold?: number;
  thresholdLabel?: string;
  suffix?: string;
  formatValue?: (value: number) => string;
}) {
  const visible = [...items].sort((a, b) => b.value - a.value).slice(0, limit);
  const max = Math.max(...visible.map((item) => item.value), threshold ?? 0, 1);
  const thresholdPosition = threshold === undefined ? null : (threshold / max) * 100;

  if (!visible.length) {
    return (
      <p className="grid min-h-48 place-items-center text-center text-sm text-[var(--text-tertiary)]">
        No ranked data is available for the selected scope.
      </p>
    );
  }

  return (
    <div role="img" aria-label={`Ranked dot chart${thresholdLabel ? ` with ${thresholdLabel}` : ""}`}>
      {thresholdPosition !== null && (
        <div className="mb-3 flex items-center justify-end gap-1.5 text-[10px] text-[var(--text-tertiary)]">
          <i className="h-3 border-l border-dashed border-[var(--text-tertiary)]" />
          {thresholdLabel ?? `Reference ${threshold}`}
        </div>
      )}
      <div className="divide-y divide-[var(--divider)]">
        {visible.map((item, index) => {
          const position = (item.value / max) * 100;
          return (
            <div key={item.label} className="grid grid-cols-[22px_minmax(80px,1fr)] gap-x-2 gap-y-2 py-3 sm:grid-cols-[22px_minmax(100px,1fr)_minmax(160px,2fr)_72px] sm:items-center sm:gap-3">
              <span className="kmm-tabular text-[11px] text-[var(--text-tertiary)]">{index + 1}</span>
              <span className="min-w-0 truncate text-xs font-medium text-[var(--text-secondary)]" title={item.label}>{item.label}</span>
              <div className="relative col-span-2 h-5 sm:col-span-1" aria-hidden="true">
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--chart-grid)]" />
                {thresholdPosition !== null && (
                  <span className="absolute inset-y-0 border-l border-dashed border-[var(--text-tertiary)]" style={{ left: `${thresholdPosition}%` }} />
                )}
                <span className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-[color-mix(in_srgb,var(--chart-current)_24%,transparent)]" style={{ width: `${position}%` }} />
                <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--chart-current)] shadow-[0_1px_3px_rgb(0_0_0/18%)]" style={{ left: `${position}%` }} />
              </div>
              <span className="kmm-tabular col-span-2 text-right text-xs font-semibold text-[var(--text-primary)] sm:col-span-1">
                {formatValue(item.value)}{suffix}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CumulativeRankChart({
  items,
  limit = 10,
  formatValue = formatNumber,
  categoryLabel = "Salesperson",
  contributionLabel = "Contribution",
  valueLabel = "Value",
  cumulativeLabel = "Cumulative",
}: {
  items: RankedDatum[];
  limit?: number;
  formatValue?: (value: number) => string;
  categoryLabel?: string;
  contributionLabel?: string;
  valueLabel?: string;
  cumulativeLabel?: string;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const visible = sorted.slice(0, limit);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(...visible.map((item) => item.value), 1);
  const rankedRows = visible.reduce<
    { item: RankedDatum; cumulativeValue: number; cumulativeShare: number }[]
  >((rows, item) => {
    const cumulativeValue = (rows.at(-1)?.cumulativeValue ?? 0) + item.value;
    return [
      ...rows,
      {
        item,
        cumulativeValue,
        cumulativeShare: total ? (cumulativeValue / total) * 100 : 0,
      },
    ];
  }, []);

  if (!visible.length) {
    return (
      <p className="grid min-h-48 place-items-center text-center text-sm text-[var(--text-tertiary)]">
        No ranked data is available for the selected scope.
      </p>
    );
  }

  return (
    <div role="img" aria-label="Ranked contribution with cumulative share">
      <div className="mb-2 grid grid-cols-[22px_minmax(90px,1fr)_64px] gap-3 text-[10px] font-semibold text-[var(--text-tertiary)] sm:grid-cols-[22px_minmax(110px,1fr)_minmax(140px,2fr)_64px_70px]">
        <span>#</span><span>{categoryLabel}</span><span className="hidden sm:block">{contributionLabel}</span><span className="text-right">{valueLabel}</span><span className="hidden text-right sm:block">{cumulativeLabel}</span>
      </div>
      <div className="divide-y divide-[var(--divider)]">
        {rankedRows.map(({ item, cumulativeShare }, index) => (
            <div key={item.label} className="grid grid-cols-[22px_minmax(90px,1fr)_64px] items-center gap-3 py-3 text-xs sm:grid-cols-[22px_minmax(110px,1fr)_minmax(140px,2fr)_64px_70px]">
              <span className="kmm-tabular text-[var(--text-tertiary)]">{index + 1}</span>
              <span className="min-w-0 truncate font-medium text-[var(--text-secondary)]" title={item.label}>{item.label}</span>
              <div className="hidden h-2 rounded-full bg-[var(--surface-muted)] sm:block" aria-hidden="true">
                <span className="block h-full rounded-full bg-[var(--chart-current)]" style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
              <span className="kmm-tabular text-right font-semibold text-[var(--text-primary)]">{formatValue(item.value)}</span>
              <span className="kmm-tabular hidden text-right text-[var(--text-tertiary)] sm:block">{cumulativeShare.toFixed(0)}%</span>
            </div>
        ))}
      </div>
    </div>
  );
}

export function BulletChart({
  actual,
  target,
  unit,
  formatValue = formatNumber,
  actualLabel = "Actual",
  targetLabel = "Target",
  emptyMessage = "Target is not configured for the selected scope.",
}: {
  actual: number;
  target: number | null;
  unit: string;
  formatValue?: (value: number) => string;
  actualLabel?: string;
  targetLabel?: string;
  emptyMessage?: string;
}) {
  if (target === null || target <= 0) {
    return (
      <p className="grid min-h-40 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] px-4 text-center text-sm text-[var(--text-tertiary)]">
        {emptyMessage}
      </p>
    );
  }

  const domain = Math.max(target, actual, 1) * 1.12;
  const actualWidth = Math.min((actual / domain) * 100, 100);
  const targetPosition = Math.min((target / domain) * 100, 100);
  const achievement = (actual / target) * 100;

  return (
    <div role="img" aria-label={`${actualLabel} ${formatValue(actual)} ${unit}, ${targetLabel} ${formatValue(target)} ${unit}, achievement ${achievement.toFixed(1)} percent`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">{actualLabel}</p>
          <p className="kmm-tabular mt-1 text-[30px] font-semibold leading-none text-[var(--text-primary)]">
            {formatValue(actual)} <span className="text-xs font-medium text-[var(--text-secondary)]">{unit}</span>
          </p>
        </div>
        <span className="kmm-tabular text-sm font-semibold text-[var(--text-primary)]">{achievement.toFixed(1)}%</span>
      </div>
      <div className="relative mt-8 h-12" aria-hidden="true">
        <div className="absolute inset-x-0 top-4 h-5 rounded-[6px] bg-[var(--surface-muted)]" />
        <div className="absolute left-0 top-4 h-5 rounded-[6px] bg-[var(--chart-current)]" style={{ width: `${actualWidth}%` }} />
        <div className="absolute top-1 h-11 w-0.5 -translate-x-1/2 bg-[var(--text-primary)]" style={{ left: `${targetPosition}%` }} />
        <span className="absolute top-0 -translate-x-1/2 text-[10px] font-semibold text-[var(--text-secondary)]" style={{ left: `${targetPosition}%` }}>{targetLabel}</span>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--text-tertiary)]">
        <span>0</span>
        <span className="kmm-tabular">{targetLabel} {formatValue(target)} {unit}</span>
      </div>
    </div>
  );
}
