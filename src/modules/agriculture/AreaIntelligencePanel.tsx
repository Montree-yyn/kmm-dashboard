"use client";

import { CalendarRange, CloudRain, Droplets, MapPin, Thermometer, Tractor } from "lucide-react";
import { cn } from "../../../lib/utils";
import { agricultureCropName, agricultureVerificationLevelLabel } from "./agriculture.ui";
import { formatNumber } from "./agriculture.data-charts";
import type { TownshipPoint } from "./agriculture.overview-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["overviewIntelligence"];
type Language = import("../../../src/locales").Language;

const MIX_COLORS = ["#3f9a4b", "#e0b420", "#e07b39", "#94a3b8"];

export function AreaIntelligencePanel({ point, copy, language }: { point: TownshipPoint | null; copy: Copy; language: Language }) {
  if (!point) {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-agri-intel-area>
        <PanelHead copy={copy} />
        <div className="mt-4 grid min-h-[280px] place-items-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-5 text-center">
          <div>
            <MapPin size={18} className="mx-auto text-[var(--text-tertiary)]" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{copy.noSelection}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{copy.noSelectionHelp}</p>
          </div>
        </div>
      </section>
    );
  }

  const mix = point.cropMix ?? [];
  const mixTotal = mix.reduce((sum, slice) => sum + slice.area, 0);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-agri-intel-area>
      <PanelHead copy={copy} />
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#47763d]"><MapPin size={16} /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{point.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">{point.stateRegion ?? "—"}{point.confidenceGrade ? ` · ${agricultureVerificationLevelLabel(point.confidenceGrade, language)}` : ""}</p>
          </div>
        </div>
        {point.opportunityCount > 0 && (
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold", point.opportunityLevel === "high" ? "border-[#f3cfb8] bg-[#fdf0e7] text-[#b45309]" : point.opportunityLevel === "medium" ? "border-[#f0d98a] bg-[#fdf6dc] text-[#8a6a00]" : "border-[#e0e2e6] bg-[#f3f4f6] text-[#6b7280]")}>
            <Tractor size={10} />{copy.opportunityBadge}: {point.opportunityLevel}
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{copy.mainCrops}</p>
        {mix.length ? (
          <ul className="mt-2 space-y-2">
            {mix.slice(0, 3).map((slice, index) => (
              <li key={slice.cropCode}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-semibold text-[var(--text-primary)]">{agricultureCropName(slice.cropName, slice.cropCode, language)}</span>
                  <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">{slice.percent}%{slice.moreThan ? " · >" : ""}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e7eef4]">
                  <div className="h-full rounded-full" style={{ width: `${slice.percent}%`, background: MIX_COLORS[index % MIX_COLORS.length] }} />
                </div>
              </li>
            ))}
            {mix.length > 3 && (
              <li>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-semibold text-[var(--text-secondary)]">{copy.others}</span>
                  <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">{mix.slice(3).reduce((sum, slice) => sum + slice.percent, 0)}%</span>
                </div>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">{copy.seasonNoData}</p>
        )}
        {point.density !== null && (
          <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">{copy.kpiArea}: {point.densityQualifier === "MORE_THAN" ? ">" : ""}{formatNumber(point.density)}{point.densityUnit ? ` ${point.densityUnit}` : ""}{mixTotal > point.density ? ` · ${formatNumber(mixTotal)}` : ""}</p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{copy.currentSeason}</p>
        <div className="mt-2 flex items-center gap-2">
          <CalendarRange size={14} className="shrink-0 text-[#47763d]" aria-hidden="true" />
          {point.plantingWindow ? (
            <span className="text-[11px] font-semibold text-[var(--text-primary)]">{point.plantingWindow}{point.seasonLabel ? ` · ${point.seasonLabel}` : ""}</span>
          ) : (
            <span className="text-[11px] text-[var(--text-secondary)]">{copy.seasonNoData}</span>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">{copy.insightCalendarHelp}</p>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{copy.weatherNow}</p>
        {point.hasWeather ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <WeatherMetric icon={<Thermometer size={13} />} value={point.temperatureC === null ? "—" : `${point.temperatureC.toFixed(1)}°C`} label={copy.temperature} />
            <WeatherMetric icon={<Droplets size={13} />} value={point.humidityPct === null ? "—" : `${point.humidityPct}%`} label={copy.humidity} />
            <WeatherMetric icon={<CloudRain size={13} />} value={point.rainfallMm === null ? "—" : `${point.rainfallMm.toFixed(1)} mm`} label={copy.rainfall} />
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">{copy.riskEmptyHelp}</p>
        )}
      </div>

      {point.floodRisk && (
        <p className="mt-4 rounded-lg border border-[#f3cfb8] bg-[#fdf0e7] px-3 py-2 text-[11px] font-semibold text-[#b45309]">
          <span className="mr-1 inline-flex items-center rounded-full border border-[#f3cfb8] bg-white px-2 py-0.5 text-[9px] font-bold">{copy.hazardHistorical}</span>
          {copy.layerRisk}: {point.hazardCount}
        </p>
      )}
    </section>
  );
}

function PanelHead({ copy }: { copy: Copy }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#eef4fb] text-[#496a9a]"><MapPin size={16} /></span>
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{copy.selectedArea}</h2>
      </div>
    </div>
  );
}

function WeatherMetric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] p-2.5">
      <div className="flex items-center gap-1 text-[#496a9a]">{icon}<span className="text-[9px] font-semibold text-[var(--text-secondary)]">{label}</span></div>
      <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
