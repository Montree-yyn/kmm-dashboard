"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  className?: string;
};

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const periods = ["YTD", "Q1", "Q2", "Q3", "Q4", ...months, "Jan-Jun", "Jan-Sep", "Full Year"];

function niceTicks(max: number, unit: string) {
  if (/unit|activit/i.test(unit) && max <= 100) return [0, 20, 40, 60, 80, 100];
  const rawStep = Math.max(max, 1) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = nice * magnitude;
  return [0, step, step * 2, step * 3, step * 4, step * 5];
}

function periodIndexes(labels: string[], period: string) {
  const mapped = labels.map((label) => months.indexOf(label.slice(0, 3)));
  const available = mapped.map((month, index) => ({ month, index })).filter(({ month }) => month >= 0);
  if (!available.length || period === "Full Year") return labels.map((_, index) => index);
  if (period === "YTD") { const max = Math.max(...available.map(({ month }) => month)); return available.filter(({ month }) => month <= max).map(({ index }) => index); }
  if (/^Q[1-4]$/.test(period)) { const quarter = Number(period[1]) - 1; return available.filter(({ month }) => Math.floor(month / 3) === quarter).map(({ index }) => index); }
  if (period === "Jan-Jun") return available.filter(({ month }) => month <= 5).map(({ index }) => index);
  if (period === "Jan-Sep") return available.filter(({ month }) => month <= 8).map(({ index }) => index);
  const month = months.indexOf(period); return available.filter((item) => item.month === month).map(({ index }) => index);
}

function change(current: number | null, prior: number | null) { return current === null || prior === null || prior === 0 ? null : ((current - prior) / prior) * 100; }

export function StandardLineChart({ title, subtitle, labels, series, unit = "Unit", height = 540, formatValue = (value) => value.toLocaleString(), metricOptions, defaultMetric, onMetricChange, defaultSeriesIds, className = "" }: StandardLineChartProps) {
  const metricItems = metricOptions?.length ? metricOptions : [{ id: "default", label: /mmk|value|cost/i.test(unit) ? "Sales Value" : "Sales Unit" }];
  const [metric, setMetric] = useState(defaultMetric ?? metricItems[0].id);
  const [yearOpen, setYearOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => defaultSeriesIds ?? series.filter((item) => item.kind !== "target").map((item) => item.id));
  const [period, setPeriod] = useState("YTD");
  const [hover, setHover] = useState<number | null>(null);
  const indices = useMemo(() => periodIndexes(labels, period), [labels, period]);
  const selected = series.filter((item) => item.kind === "target" || selectedIds.includes(item.id));
  const shown = selected.map((item) => ({ ...item, values: indices.map((index) => item.values[index] ?? null) }));
  const shownLabels = indices.map((index) => labels[index]);
  const max = Math.max(...shown.flatMap((item) => item.values.map((value) => value ?? 0)), 1);
  const ticks = niceTicks(max, unit); const top = ticks.at(-1) ?? 1;
  const width = 1000; const px = 76; const py = 48;
  const x = (index: number) => px + (index * (width - px * 2)) / Math.max(shownLabels.length - 1, 1);
  const y = (value: number) => height - py - (value / top) * (height - py * 2);
  const path = (values: Array<number | null>) => values.reduce((result, value, index) => { if (value === null) return result; const previous = values[index - 1]; if (previous === null || previous === undefined) return `${result} M ${x(index)} ${y(value)}`; const middle = (x(index - 1) + x(index)) / 2; return `${result} C ${middle} ${y(previous)}, ${middle} ${y(value)}, ${x(index)} ${y(value)}`; }, "");
  const style = (item: StandardLineSeries, index: number) => { const kind = item.kind ?? (index === 0 ? "current" : index === 1 ? "previous" : "older"); if (kind === "target") return { color: chartTheme.target, width: chartStroke.target, dash: "7 7" }; if (kind === "current") return { color: chartTheme.current, width: chartStroke.current }; if (kind === "previous") return { color: chartTheme.previous, width: chartStroke.previous }; return { color: chartTheme.older[Math.max(0, index - 2) % chartTheme.older.length], width: chartStroke.older }; };
  const actuals = shown.filter((item) => item.kind !== "target"); const current = actuals[0]; const previous = actuals[1];
  const nonNull = (current?.values ?? []).map((value, index) => ({ value, index })).filter((item): item is { value: number; index: number } => item.value !== null);
  const best = nonNull.length ? nonNull.reduce((a, b) => a.value > b.value ? a : b) : null; const lowest = nonNull.length ? nonNull.reduce((a, b) => a.value < b.value ? a : b) : null;
  const totals = (item?: StandardLineSeries) => item?.values.reduce((sum, value) => sum + (value ?? 0), 0) ?? 0;
  const growth = change(totals(current), totals(previous)); const target = shown.find((item) => item.kind === "target"); const achievement = target && totals(target) ? (totals(current) / totals(target)) * 100 : null;
  const delta = hover === null ? null : change(current?.values[hover] ?? null, previous?.values[hover] ?? null);
  const selectedYearsText = selected.filter((item) => item.kind !== "target").map((item) => item.year ?? item.label.match(/20\d{2}/)?.[0] ?? item.label).join(", ");
  const pickMetric = (value: string) => { setMetric(value); onMetricChange?.(value); };

  return <section className={`rounded-2xl border border-[#E8EAED] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)] sm:p-6 ${className}`}>
    {title && <header className="flex flex-col gap-4 border-b border-[#EEF0F3] pb-5 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#1F2937]">{title}</h2>{subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}</div><div className="flex flex-wrap items-center gap-2 xl:flex-nowrap"><label className="sr-only" htmlFor={`${title}-metric`}>Metric</label><select id={`${title}-metric`} value={metric} onChange={(event) => pickMetric(event.target.value)} className="h-9 min-w-[112px] rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#374151] outline-none transition focus:border-[#FDBA74] focus:ring-2 focus:ring-[#F97316]/10">{metricItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><div className="relative"><button type="button" onClick={() => setYearOpen((open) => !open)} aria-expanded={yearOpen} className="flex h-9 min-w-[116px] items-center justify-between gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#374151] transition hover:border-[#D1D5DB]">{selectedYearsText || "Compare Year"}<ChevronDown size={14} /></button>{yearOpen && <div className="absolute right-0 top-11 z-30 w-48 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-[0_12px_30px_rgba(31,41,55,.13)]">{series.filter((item) => item.kind !== "target").map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#FFF7ED]"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((ids) => ids.includes(item.id) ? ids.length > 1 ? ids.filter((id) => id !== item.id) : ids : [...ids, item.id])} className="size-4 accent-[#F97316]" />{item.year ?? item.label}</label>)}</div>}</div><label className="sr-only" htmlFor={`${title}-period`}>Period</label><select id={`${title}-period`} value={period} onChange={(event) => setPeriod(event.target.value)} className="h-9 min-w-[104px] rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#374151] outline-none transition focus:border-[#FDBA74] focus:ring-2 focus:ring-[#F97316]/10">{periods.map((item) => <option key={item}>{item}</option>)}</select></div></header>}
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#4B5563]">{shown.map((item, index) => { const token = style(item, index); return <span key={item.id} className="flex items-center gap-2"><i className="h-0 w-7 border-t-[3px]" style={{ borderColor: token.color, borderStyle: token.dash ? "dashed" : "solid" }} />{item.kind === "target" ? "Target" : `${item.year ?? item.label} Actual`}</span>; })}</div>
    <div className="relative mt-4"><svg className="w-full" style={{ height }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title ?? "Trend"} chart`} onMouseLeave={() => setHover(null)}><title>{title ?? "Premium trend chart"}</title>{ticks.map((tick) => <g key={tick}><line x1={px} x2={width - px} y1={y(tick)} y2={y(tick)} stroke={chartTheme.grid} /><text x={px - 12} y={y(tick) + 4} textAnchor="end" fontSize="12" fill={chartTheme.text}>{formatValue(tick)}</text></g>)}<text x={px} y={19} fontSize="12" fontWeight="700" fill={chartTheme.text}>{unit}</text>{shown.map((item, seriesIndex) => { const token = style(item, seriesIndex); return <g key={item.id}><path d={path(item.values)} fill="none" stroke={token.color} strokeWidth={4} strokeDasharray={token.dash} strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 2px rgba(31,41,55,.08))", transition: "all 250ms ease" }} />{item.values.map((value, index) => value === null ? null : <circle key={index} cx={x(index)} cy={y(value)} r={hover === index ? 6 : 4} fill="white" stroke={token.color} strokeWidth="2.5" onMouseEnter={() => setHover(index)} style={{ transition: "r 250ms ease" }} />)}</g>; })}{shownLabels.map((label, index) => <text key={`${label}-${index}`} x={x(index)} y={height - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill={chartTheme.text}>{label}</text>)}</svg>{hover !== null && <div className="pointer-events-none absolute top-8 z-10 min-w-56 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-xs text-[#4B5563] shadow-[0_14px_32px_rgba(31,41,55,.14)]" style={{ left: `${Math.min(Math.max((x(hover) / width) * 100, 7), 70)}%` }}><p className="font-bold text-[#1F2937]">{shownLabels[hover]}</p>{shown.map((item) => <p key={item.id} className="mt-1">{item.year ?? item.label}: <strong>{item.values[hover] === null ? "No data" : formatValue(item.values[hover] ?? 0)}</strong></p>)}{previous && <p className="mt-2 border-t border-[#EEF0F3] pt-2">Difference vs previous year: <strong>{delta === null ? "N/A" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}</strong></p>}{target && <p>Target: <strong>{formatValue(target.values[hover] ?? 0)}</strong> · Variance: <strong>{formatValue((current?.values[hover] ?? 0) - (target.values[hover] ?? 0))}</strong></p>}</div>}</div>
    <div className="mt-5 grid grid-cols-2 divide-x divide-y divide-[#EEF0F3] overflow-hidden rounded-xl border border-[#EEF0F3] sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0"><Insight label="Best Month" value={best ? shownLabels[best.index] : "N/A"} detail={best ? formatValue(best.value) : ""} /><Insight label="Lowest Month" value={lowest ? shownLabels[lowest.index] : "N/A"} detail={lowest ? formatValue(lowest.value) : ""} /><Insight label="Average Growth" value={growth === null ? "N/A" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`} /><Insight label="Trend" value={growth === null ? "N/A" : growth >= 0 ? "Increasing" : "Declining"} /><Insight label="Achievement" value={achievement === null ? "N/A" : `${achievement.toFixed(0)}%`} /><Insight label="YTD Total" value={formatValue(totals(current))} /></div>
  </section>;
}

function Insight({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="min-w-0 bg-[#FCFCFD] px-3 py-3"><p className="truncate text-[10px] font-bold uppercase tracking-[.08em] text-[#9CA3AF]">{label}</p><p className="mt-1 truncate text-sm font-semibold text-[#1F2937]">{value}</p>{detail && <p className="truncate text-xs text-[#6B7280]">{detail}</p>}</div>; }
