"use client";

/** Chart primitives and number helpers shared by the Agriculture Data dashboard. */
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import type { Donut, DonutSegment, RankingPoint, TrendPoint } from "./agriculture.data-view";

export const CHART_COLORS = ["#3f9a4b", "#5a8db8", "#e0b420", "#e07b39", "#a8b56e", "#94a3b8"];

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatCropYear(year: number | null | undefined) {
  if (year === null || year === undefined) return "";
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

export function DonutChart({ donut, centerLabel, centerValue, centerUnit, segmentName }: { donut: Donut; centerLabel: string; centerValue: string; centerUnit: string | null; segmentName: (segment: DonutSegment) => string }) {
  let cursor = 0;
  const stops: string[] = [];
  donut.segments.forEach((segment, index) => {
    const color = CHART_COLORS[index % CHART_COLORS.length];
    stops.push(`${color} ${cursor}% ${(cursor + segment.percent).toFixed(2)}%`);
    cursor += segment.percent;
  });
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
      <div className="relative size-36 shrink-0">
        <div className="size-full rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }} aria-hidden="true" />
        <div className="absolute inset-[22px] grid place-items-center rounded-full bg-white text-center shadow-inner">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{centerLabel}</p>
            <p className="text-lg font-bold leading-tight text-[var(--text-primary)]">{centerValue}</p>
            {centerUnit && <p className="text-[10px] text-[var(--text-tertiary)]">{centerUnit}</p>}
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {donut.segments.map((segment, index) => (
          <li key={`${segment.cropCode}-${index}`} className="flex items-center gap-2 text-[11px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text-primary)]">{segmentName(segment)}</span>
            <span className="text-[var(--text-secondary)]">{segment.moreThan ? ">" : ""}{segment.percent}%</span>
            <strong className="tabular-nums text-[var(--text-primary)]">{segment.moreThan ? ">" : ""}{formatNumber(segment.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankingBars({ points, unit, max = 5 }: { points: RankingPoint[]; unit: string | null; max?: number }) {
  const top = points.slice(0, max);
  const peak = Math.max(...top.map((point) => point.value), 0);
  if (!top.length) return null;
  return (
    <div className="space-y-3">
      {top.map((point) => (
        <div key={point.locationName}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
            <span className="truncate text-[var(--text-secondary)]">{point.locationName}</span>
            <strong className="tabular-nums text-[var(--text-primary)]">{point.moreThan ? ">" : ""}{formatNumber(point.value)}{unit ? ` ${unit}` : ""}</strong>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#e7eef4]">
            <div className="h-full rounded-full bg-[var(--brand-400)]" style={{ width: `${peak ? Math.max((point.value / peak) * 100, 2) : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Minimal SVG line chart with an optional area fill. Points are labeled when space allows. */
export function TrendLineChart({ points, width = 560, height = 200 }: { points: TrendPoint[]; width?: number; height?: number }) {
  const padding = { top: 14, right: 14, bottom: 30, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const range = Math.max(max - min, 1);
  const x = (index: number) => padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - ((value - min) / range) * plotHeight;
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const areaPath = points.length > 1 ? `${path} L${x(points.length - 1).toFixed(1)},${padding.top + plotHeight} L${x(0).toFixed(1)},${padding.top + plotHeight} Z` : "";
  const gridLines = [0, 1, 2, 3, 4].map((index) => ({
    y: padding.top + plotHeight - (index / 4) * plotHeight,
    value: min + (index / 4) * range,
  }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${points.map((point) => `${point.label}: ${point.value}`).join(", ")}`}>
      {gridLines.map((line) => (
        <g key={line.y}>
          <line x1={padding.left} y1={line.y} x2={width - padding.right} y2={line.y} stroke="#eef1f4" strokeWidth={1} />
          <text x={padding.left - 6} y={line.y + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{formatAxis(line.value, max)}</text>
        </g>
      ))}
      {points.length > 1 && <path d={areaPath} fill="#eef7eb" stroke="none" />}
      <path d={path} fill="none" stroke="#3f9a4b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle cx={x(index)} cy={y(point.value)} r={3.5} fill="#fff" stroke="#3f9a4b" strokeWidth={2} />
          <text x={x(index)} y={height - 10} textAnchor="middle" fontSize={9} fill="#6b7280">{point.label}</text>
          <text x={x(index)} y={y(point.value) - 8} textAnchor="middle" fontSize={9} fontWeight={600} fill="#1f2937">{formatNumber(point.value)}</text>
        </g>
      ))}
    </svg>
  );
}

function formatAxis(value: number, max: number) {
  if (max >= 10000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

export function ChartCard({ title, subtitle, action, children, empty, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; empty?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold leading-snug text-[var(--text-primary)]">{title}</h3>
          {subtitle && <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{empty ? <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 text-xs leading-5 text-[var(--text-secondary)]">{empty}</div> : children}</div>
    </section>
  );
}

/** Empty state used across the data dashboard. */
export function DataEmptyState({ title, message, className }: { title: string; message?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-5 text-center", className)}>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {message && <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{message}</p>}
    </div>
  );
}
