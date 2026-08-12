"use client";

import { useId, useMemo, useState } from "react";
import { TrendChartToolbar, type TrendPeriod } from "../TrendChartToolbar";
import { chartStroke, chartTheme } from "./chartTheme";

export type StandardLineSeries = { id: string; label: string; values: Array<number | null>; kind?: "current" | "previous" | "older" | "target"; year?: number };
export type TrendMetricOption = { id: string; label: string };
export type StandardLineChartProps = {
  title?: string;
  subtitle?: string;
  labels: string[];
  series: StandardLineSeries[];
  unit?: string;
  height?: number;
  formatValue?: (value: number) => string;
  metricOptions?: TrendMetricOption[];
  defaultMetric?: string;
  onMetricChange?: (metric: string) => void;
  defaultSeriesIds?: string[];
  defaultPeriod?: TrendPeriod;
  onPeriodChange?: (period: TrendPeriod) => void;
  visualStyle?: "classic" | "precision";
  className?: string;
};

function niceTicks(max: number, unit: string) {
  if (/unit|activit/i.test(unit) && max <= 100) return [0, 20, 40, 60, 80, 100];
  const rawStep = Math.max(max, 1) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  return [0, step, step * 2, step * 3, step * 4, step * 5];
}

function linePath(values: Array<number | null>, x: (index: number) => number, y: (value: number) => number) {
  return values.reduce((result, value, index) => {
    if (value === null) return result;
    const previous = values[index - 1];
    if (previous === null || previous === undefined) return `${result} M ${x(index)} ${y(value)}`;
    return `${result} L ${x(index)} ${y(value)}`;
  }, "");
}

function areaPath(values: Array<number | null>, x: (index: number) => number, y: (value: number) => number) {
  const paths: string[] = [];
  let start = -1;
  for (let index = 0; index <= values.length; index += 1) {
    const value = values[index];
    if (value !== null && value !== undefined && start === -1) start = index;
    if ((value === null || value === undefined || index === values.length) && start !== -1) {
      const end = index - 1;
      const segment = values.map((item, itemIndex) => itemIndex >= start && itemIndex <= end ? item : null);
      paths.push(`${linePath(segment, x, y)} L ${x(end)} ${y(0)} L ${x(start)} ${y(0)} Z`);
      start = -1;
    }
  }
  return paths.join(" ");
}

function periodIndices(period: TrendPeriod, count: number) {
  if (period === "jan-mar") return [0, 1, 2];
  if (period === "apr-jun") return [3, 4, 5];
  if (period === "jul-sep") return [6, 7, 8];
  if (period === "oct-dec") return [9, 10, 11];
  if (period === "ytd") return Array.from({ length: Math.min(new Date().getMonth() + 1, count) }, (_, index) => index);
  return Array.from({ length: count }, (_, index) => index);
}

export function StandardLineChart({ title, subtitle, labels, series, unit = "Unit", height = 420, formatValue = (value) => value.toLocaleString(), metricOptions, defaultMetric, onMetricChange, defaultSeriesIds, defaultPeriod = "ytd", onPeriodChange, visualStyle = "classic", className = "" }: StandardLineChartProps) {
  const gradientId = useId().replaceAll(":", "");
  const metricItems = metricOptions?.length ? metricOptions : [{ id: "unit", label: "Sales Unit" }, { id: "value", label: "Sales Value" }];
  const actualSeries = series.filter((item) => item.kind !== "target");
  const [metric, setMetric] = useState(defaultMetric ?? metricItems[0].id);
  const [selectedIds, setSelectedIds] = useState(() => defaultSeriesIds ?? actualSeries.slice(0, 2).map((item) => item.id));
  const [period, setPeriod] = useState<TrendPeriod>(defaultPeriod);
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const indices = useMemo(() => periodIndices(period, labels.length), [period, labels.length]);
  const selectedActualIds = selectedIds.filter((id) => actualSeries.some((item) => item.id === id));
  const yearOptions = actualSeries.map((item) => String(item.year ?? item.id))
    .filter((year, index, values) => values.indexOf(year) === index)
    .map((year) => ({ id: year, label: year }));
  const shown = series.filter((item) => item.kind === "target" || selectedActualIds.includes(item.id)).map((item) => ({ ...item, values: indices.map((index) => item.values[index] ?? null) }));
  const shownLabels = indices.map((index) => labels[index]);
  const max = Math.max(...shown.flatMap((item) => item.values.map((value) => value ?? 0)), 1);
  const ticks = niceTicks(max, unit); const top = ticks.at(-1) ?? 1;
  const width = 920; const px = 72; const py = 52;
  const x = (index: number) => px + (index * (width - px * 2)) / Math.max(shownLabels.length - 1, 1);
  const y = (value: number) => height - py - (value / top) * (height - py * 2);
  const style = (item: StandardLineSeries, index: number) => {
    const kind = item.kind ?? (index === 0 ? "current" : index === 1 ? "previous" : "older");
    if (kind === "target") return { color: chartTheme.target, width: chartStroke.target, dash: "8 7" };
    if (kind === "current") return { color: chartTheme.current, width: visualStyle === "precision" ? 3 : chartStroke.current };
    if (kind === "previous") return visualStyle === "precision"
      ? { color: "#6B6C70", width: 2.25, dash: "2 7" }
      : { color: chartTheme.previous, width: chartStroke.previous };
    return { color: chartTheme.older[Math.max(0, index - 2) % chartTheme.older.length], width: chartStroke.older };
  };
  const dataLabelY = (seriesIndex: number, pointIndex: number, value: number) => {
    const occupied = shown.slice(0, seriesIndex).flatMap((item, index) => {
      const prior = item.values[pointIndex];
      return prior === null ? [] : [y(prior) + (index % 2 === 0 ? -13 : 20)];
    });
    let candidate = y(value) + (seriesIndex % 2 === 0 ? -13 : 20);
    while (occupied.some((position) => Math.abs(position - candidate) < 15)) candidate += candidate < y(value) ? -15 : 15;
    return Math.max(18, Math.min(height - py - 4, candidate));
  };
  const pickMetric = (value: string) => { setMetric(value); onMetricChange?.(value); };
  const pickPeriod = (value: TrendPeriod) => { setPeriod(value); onPeriodChange?.(value); };
  const hitWidth = Math.max((width - px * 2) / Math.max(shownLabels.length - 1, 1), 44);
  const activeX = activePoint === null ? 0 : (x(activePoint) / width) * 100;
  const tooltipTransform = activePoint === 0
    ? "translateX(0)"
    : activePoint === shownLabels.length - 1
      ? "translateX(-100%)"
      : "translateX(-50%)";
  const mobileStart = Math.max(shownLabels.length - 6, 0);
  const mobileLabels = shownLabels.slice(mobileStart);
  const mobileSeries = shown.map((item) => ({
    ...item,
    values: item.values.slice(mobileStart),
  }));
  const mobileWidth = 360;
  const mobileHeight = 250;
  const mobilePx = 42;
  const mobilePy = 36;
  const mobileX = (index: number) =>
    mobilePx +
    (index * (mobileWidth - mobilePx * 2)) /
      Math.max(mobileLabels.length - 1, 1);
  const mobileY = (value: number) =>
    mobileHeight -
    mobilePy -
    (value / top) * (mobileHeight - mobilePy * 2);
  const mobileTicks = [0, top / 2, top];

  return (
    <section className={`rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6 ${className}`} role="region" aria-label={`${title ?? "Trend"} chart`}>
      {title && (
        <header className="flex flex-col items-start justify-between gap-3 border-b border-[var(--divider)] pb-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="shrink-0">
            <h2 className="text-[20px] font-semibold tracking-normal text-[var(--text-primary)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtitle}</p>}
          </div>
          <TrendChartToolbar metric={metric} selectedYears={selectedActualIds} period={period} onMetricChange={pickMetric} onYearChange={setSelectedIds} onPeriodChange={pickPeriod} metricOptions={metricItems} yearOptions={yearOptions} />
        </header>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-[var(--text-secondary)]">
        {shown.map((item, index) => {
          const token = style(item, index);
          return (
            <span key={item.id} className="flex items-center gap-2">
              <i className="h-0 w-7 border-t-[3px]" style={{ borderColor: token.color, borderStyle: token.dash ? "dashed" : "solid" }} />
              {item.kind === "target" ? "Target" : item.year ?? item.label}
            </span>
          );
        })}
      </div>
      <div className="mt-4 sm:hidden">
        <svg
          className="aspect-[36/25] w-full"
          viewBox={`0 0 ${mobileWidth} ${mobileHeight}`}
          role="img"
          aria-label={`${title ?? "Trend"} compact chart showing the latest ${mobileLabels.length} periods`}
        >
          <title>{title ?? "Trend"} · latest {mobileLabels.length} periods</title>
          {visualStyle === "precision" && (
            <defs>
              <linearGradient id={`${gradientId}-mobile`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={chartTheme.current} stopOpacity="0.18" />
                <stop offset="100%" stopColor={chartTheme.current} stopOpacity="0" />
              </linearGradient>
            </defs>
          )}
          {mobileTicks.map((tick) => (
            <g key={tick}>
              <line x1={mobilePx} x2={mobileWidth - mobilePx} y1={mobileY(tick)} y2={mobileY(tick)} stroke={chartTheme.grid} strokeWidth="1" />
              <text x={mobilePx - 8} y={mobileY(tick) + 3} textAnchor="end" fontSize="9" fill={chartTheme.text}>{formatValue(tick)}</text>
            </g>
          ))}
          <text x={mobilePx} y={14} fontSize="9" fontWeight="700" fill={chartTheme.text}>{unit}</text>
          {visualStyle === "precision" && mobileSeries.map((item) => item.kind === "current" ? (
            <path key={`${item.id}-mobile-area`} d={areaPath(item.values, mobileX, mobileY)} fill={`url(#${gradientId}-mobile)`} stroke="none" aria-hidden="true" />
          ) : null)}
          {mobileSeries.map((item, seriesIndex) => {
            const token = style(item, seriesIndex);
            const lastIndex = item.values.reduce<number>((latest, value, index) => value === null ? latest : index, -1);
            return (
              <g key={`${item.id}-mobile`}>
                <path d={linePath(item.values, mobileX, mobileY)} fill="none" stroke={token.color} strokeWidth={token.width} strokeDasharray={token.dash} strokeLinecap="round" strokeLinejoin="round" />
                {lastIndex >= 0 && item.values[lastIndex] !== null && (
                  <circle cx={mobileX(lastIndex)} cy={mobileY(item.values[lastIndex] as number)} r="4" fill="white" stroke={token.color} strokeWidth="2.25" />
                )}
              </g>
            );
          })}
          {mobileLabels.map((label, index) => (
            <text key={`${label}-${index}-mobile`} x={mobileX(index)} y={mobileHeight - 11} textAnchor="middle" fontSize="9" fontWeight="600" fill={chartTheme.text}>{label}</text>
          ))}
        </svg>
      </div>

      <div className="mt-3 hidden overflow-x-auto sm:block">
        <div className="relative min-w-[680px]" onMouseLeave={() => setActivePoint(null)}>
          <svg className="w-full" style={{ height }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title ?? "Trend"} chart with ${shown.length} series`}>
            <title>{title ?? "Premium trend chart"}</title>
            {visualStyle === "precision" && (
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={chartTheme.current} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={chartTheme.current} stopOpacity="0" />
                </linearGradient>
              </defs>
            )}
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={px} x2={width - px} y1={y(tick)} y2={y(tick)} stroke={chartTheme.grid} strokeWidth="1" />
                <text x={px - 14} y={y(tick) + 4} textAnchor="end" fontSize="11" fill={chartTheme.text}>{formatValue(tick)}</text>
              </g>
            ))}
            <text x={px} y={19} fontSize="11" fontWeight="700" fill={chartTheme.text}>{unit}</text>

            {visualStyle === "precision" && shown.map((item) => item.kind === "current" ? (
              <path key={`${item.id}-area`} d={areaPath(item.values, x, y)} fill={`url(#${gradientId})`} stroke="none" aria-hidden="true" />
            ) : null)}

            {shown.map((item, seriesIndex) => {
              const token = style(item, seriesIndex);
              const lastIndex = item.values.reduce((latest, value, index) => value === null ? latest : index, -1);
              return (
                <g key={item.id}>
                  <path
                    d={linePath(item.values, x, y)}
                    fill="none"
                    stroke={token.color}
                    strokeWidth={token.width}
                    strokeDasharray={token.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={visualStyle === "classic" ? { filter: "drop-shadow(0 2px 2px rgba(31,41,55,.08))" } : undefined}
                  />
                  {item.values.map((value, index) => {
                    if (value === null) return null;
                    if (visualStyle === "precision") {
                      if (index !== lastIndex && index !== activePoint) return null;
                      return <circle key={index} cx={x(index)} cy={y(value)} r={index === activePoint ? 5.5 : 4} fill="white" stroke={token.color} strokeWidth="2.5" />;
                    }
                    return (
                      <g key={index}>
                        <circle cx={x(index)} cy={y(value)} r="6.5" fill="white" stroke={token.color} strokeWidth="2.75" />
                        <text x={x(index)} y={dataLabelY(seriesIndex, index, value)} textAnchor="middle" fontSize="10" fontWeight="700" fill={token.color} paintOrder="stroke" stroke="white" strokeWidth="3" strokeLinejoin="round">{formatValue(value)}</text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {shownLabels.map((label, index) => (
              <text key={`${label}-${index}`} x={x(index)} y={height - 14} textAnchor="middle" fontSize="11" fontWeight="600" fill={chartTheme.text}>{label}</text>
            ))}

            {shownLabels.map((label, index) => (
              <rect
                key={`${label}-${index}-hit`}
                x={x(index) - hitWidth / 2}
                y={py - 12}
                width={hitWidth}
                height={height - py * 2 + 24}
                fill="transparent"
                role="img"
                tabIndex={0}
                aria-label={`${label}: ${shown.map((item) => `${item.label} ${item.values[index] === null ? "no data" : formatValue(item.values[index] as number)}`).join(", ")}`}
                onMouseEnter={() => setActivePoint(index)}
                onFocus={() => setActivePoint(index)}
                onBlur={() => setActivePoint(null)}
                onTouchStart={() => setActivePoint(index)}
              />
            ))}
          </svg>

          {activePoint !== null && (
            <div
              className="pointer-events-none absolute top-3 z-10 min-w-36 rounded-[10px] bg-[var(--text-primary)] px-3 py-2 text-xs text-white shadow-[var(--shadow-floating)]"
              style={{ left: `${activeX}%`, transform: tooltipTransform }}
              role="status"
            >
              <p className="font-semibold">{shownLabels[activePoint]}</p>
              <div className="mt-1.5 space-y-1">
                {shown.map((item) => (
                  <p key={item.id} className="flex items-center justify-between gap-4 text-white/80">
                    <span>{item.kind === "target" ? "Target" : item.year ?? item.label}</span>
                    <strong className="kmm-tabular text-white">{item.values[activePoint] === null ? "—" : formatValue(item.values[activePoint] as number)}</strong>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="sr-only">
        {shown.map((item) => {
          const last = [...item.values].reverse().find((value) => value !== null);
          return `${item.label}: latest ${last === undefined || last === null ? "no data" : formatValue(last)}.`;
        }).join(" ")}
      </p>
    </section>
  );
}
