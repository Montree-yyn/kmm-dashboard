"use client";

import { useMemo, useState } from "react";
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

function smoothPath(values: Array<number | null>, x: (index: number) => number, y: (value: number) => number) {
  return values.reduce((result, value, index) => {
    if (value === null) return result;
    const previous = values[index - 1];
    if (previous === null || previous === undefined) return `${result} M ${x(index)} ${y(value)}`;
    const middle = (x(index - 1) + x(index)) / 2;
    return `${result} C ${middle} ${y(previous)}, ${middle} ${y(value)}, ${x(index)} ${y(value)}`;
  }, "");
}

function periodIndices(period: TrendPeriod, count: number) {
  if (period === "jan-mar") return [0, 1, 2];
  if (period === "apr-jun") return [3, 4, 5];
  if (period === "jul-sep") return [6, 7, 8];
  if (period === "oct-dec") return [9, 10, 11];
  if (period === "ytd") return Array.from({ length: Math.min(new Date().getMonth() + 1, count) }, (_, index) => index);
  return Array.from({ length: count }, (_, index) => index);
}

export function StandardLineChart({ title, subtitle, labels, series, unit = "Unit", height = 420, formatValue = (value) => value.toLocaleString(), metricOptions, defaultMetric, onMetricChange, defaultSeriesIds, defaultPeriod = "ytd", onPeriodChange, className = "" }: StandardLineChartProps) {
  const metricItems = metricOptions?.length ? metricOptions : [{ id: "unit", label: "Sales Unit" }, { id: "value", label: "Sales Value" }];
  const actualSeries = series.filter((item) => item.kind !== "target");
  const [metric, setMetric] = useState(defaultMetric ?? metricItems[0].id);
  const [selectedIds, setSelectedIds] = useState(() => defaultSeriesIds ?? actualSeries.slice(0, 2).map((item) => item.id));
  const [period, setPeriod] = useState<TrendPeriod>(defaultPeriod);
  const indices = useMemo(() => periodIndices(period, labels.length), [period, labels.length]);
  const selectedActualIds = selectedIds.filter((id) => actualSeries.some((item) => item.id === id));
  const yearOptions = ["2026", "2025", "2024", "2023", "2022", ...actualSeries.map((item) => String(item.year ?? item.id))]
    .filter((year, index, values) => values.indexOf(year) === index)
    .map((year) => ({ id: year, label: year }));
  const shown = series.filter((item) => item.kind === "target" || selectedActualIds.includes(item.id)).map((item) => ({ ...item, values: indices.map((index) => item.values[index] ?? null) }));
  const shownLabels = indices.map((index) => labels[index]);
  const max = Math.max(...shown.flatMap((item) => item.values.map((value) => value ?? 0)), 1);
  const ticks = niceTicks(max, unit); const top = ticks.at(-1) ?? 1;
  const width = 1120; const px = 84; const py = 52;
  const x = (index: number) => px + (index * (width - px * 2)) / Math.max(shownLabels.length - 1, 1);
  const y = (value: number) => height - py - (value / top) * (height - py * 2);
  const style = (item: StandardLineSeries, index: number) => {
    const kind = item.kind ?? (index === 0 ? "current" : index === 1 ? "previous" : "older");
    if (kind === "target") return { color: chartTheme.target, width: chartStroke.target, dash: "8 7" };
    if (kind === "current") return { color: chartTheme.current, width: chartStroke.current };
    if (kind === "previous") return { color: chartTheme.previous, width: chartStroke.previous };
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

  return <section className={`rounded-2xl border border-[#E8EAED] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)] sm:p-6 ${className}`}>
    {title && <header className="flex flex-col items-start justify-between gap-3 border-b border-[#EEF0F3] pb-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="shrink-0"><h2 className="text-[20px] font-bold tracking-[-0.025em] text-[#111827]">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p>}</div>
      <TrendChartToolbar metric={metric} selectedYears={selectedActualIds} period={period} onMetricChange={pickMetric} onYearChange={setSelectedIds} onPeriodChange={pickPeriod} metricOptions={metricItems} yearOptions={yearOptions} />
    </header>}
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-[#475569]">{shown.map((item, index) => { const token = style(item, index); return <span key={item.id} className="flex items-center gap-2"><i className="h-0 w-7 border-t-[3px]" style={{ borderColor: token.color, borderStyle: token.dash ? "dashed" : "solid" }} />{item.kind === "target" ? "Target" : item.year ?? item.label}</span>; })}</div>
    <div className="relative mt-3 overflow-x-auto"><svg className="min-w-[680px] w-full" style={{ height }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title ?? "Trend"} chart`}><title>{title ?? "Premium trend chart"}</title>{ticks.map((tick) => <g key={tick}><line x1={px} x2={width - px} y1={y(tick)} y2={y(tick)} stroke={chartTheme.grid} strokeWidth="1" /><text x={px - 14} y={y(tick) + 4} textAnchor="end" fontSize="11" fill={chartTheme.text}>{formatValue(tick)}</text></g>)}<text x={px} y={19} fontSize="11" fontWeight="700" fill={chartTheme.text}>{unit}</text>{shown.map((item, seriesIndex) => { const token = style(item, seriesIndex); return <g key={item.id}><path d={smoothPath(item.values, x, y)} fill="none" stroke={token.color} strokeWidth={token.width} strokeDasharray={token.dash} strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 2px rgba(31,41,55,.08))", transition: "all 250ms ease" }} />{item.values.map((value, index) => value === null ? null : <g key={index}><circle cx={x(index)} cy={y(value)} r="6.5" fill="white" stroke={token.color} strokeWidth="2.75" /><text x={x(index)} y={dataLabelY(seriesIndex, index, value)} textAnchor="middle" fontSize="10" fontWeight="700" fill={token.color} paintOrder="stroke" stroke="white" strokeWidth="3" strokeLinejoin="round">{formatValue(value)}</text></g>)}</g>; })}{shownLabels.map((label, index) => <text key={`${label}-${index}`} x={x(index)} y={height - 14} textAnchor="middle" fontSize="11" fontWeight="600" fill={chartTheme.text}>{label}</text>)}</svg></div>
  </section>;
}
