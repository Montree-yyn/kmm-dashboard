"use client";

import { lazy, Suspense, useMemo, useState } from "react";
import { MapPin, Sprout, Tractor, CloudLightning } from "lucide-react";
import { cn } from "../../../lib/utils";
import { getMapDataset } from "../../../lib/maps/datasets";
import { LoadingSkeleton } from "../../../components/design-system/loading-skeleton";
import { agricultureCropName } from "./agriculture.ui";

// MapLibre + PMTiles + Protomaps basemap are the heaviest chunk on the
// agriculture overview; load them only when the map section mounts.
const GlobalVectorMap = lazy(() =>
  import("../../../components/maps/global-vector-map").then((module) => ({
    default: module.GlobalVectorMap,
  })),
);
import type { TownshipPoint } from "./agriculture.overview-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["overviewIntelligence"];
type Language = import("../../../src/locales").Language;

type IntelLayer = "density" | "crop" | "opportunity" | "risk";

const DENSITY_COLORS = {
  high: "#2f8f4a",
  medium: "#e0b420",
  low: "#e07b39",
  none: "#d7dde3",
};

const CROP_COLORS = ["#3f9a4b", "#5a8db8", "#e0b420", "#e07b39", "#a8b56e", "#94a3b8"];

const dataset = getMapDataset("mm-townships-pmtiles");

export function AgricultureIntelligenceMap({ townships, selected, onSelect, copy, language }: { townships: TownshipPoint[]; selected: TownshipPoint | null; onSelect: (point: TownshipPoint | null) => void; copy: Copy; language: Language }) {
  const [layer, setLayer] = useState<IntelLayer>("density");
  const byCanonical = useMemo(() => new Map(townships.filter((point) => point.canonicalId).map((point) => [point.canonicalId as string, point])), [townships]);

  const fillColors = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const point of townships) {
      if (!point.canonicalId) continue;
      if (layer === "density") {
        colors[point.canonicalId] = DENSITY_COLORS[point.densityBand];
      } else if (layer === "crop") {
        if (point.mainCropCode && point.cropCount > 0) {
          colors[point.canonicalId] = CROP_COLORS[stableIndex(point.mainCropCode)];
        } else {
          colors[point.canonicalId] = DENSITY_COLORS.none;
        }
      } else if (layer === "opportunity") {
        colors[point.canonicalId] = point.opportunityLevel === "none" ? DENSITY_COLORS.none : point.opportunityLevel === "high" ? "#b45309" : point.opportunityLevel === "medium" ? "#e0b420" : "#f0d98a";
      } else {
        colors[point.canonicalId] = point.floodRisk ? "#b91c1c" : DENSITY_COLORS.none;
      }
    }
    return colors;
  }, [townships, layer]);

  const opportunityEmpty = layer === "opportunity" && !townships.some((point) => point.opportunityCount > 0);
  const riskEmpty = layer === "risk" && !townships.some((point) => point.hazardCount > 0);

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]" data-agri-intel-map>
      <div className="flex flex-col gap-3 border-b border-[var(--divider)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-[#eef7eb] text-[#47763d]"><MapPin size={16} /></span>
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{copy.mapTitle}</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{copy.mapSub}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface-subtle)] p-1" role="tablist" aria-label={copy.mapTitle}>
          {([
            { value: "density", icon: Sprout, label: copy.layerDensity },
            { value: "crop", icon: Sprout, label: copy.layerCropType },
            { value: "opportunity", icon: Tractor, label: copy.layerOpportunity },
            { value: "risk", icon: CloudLightning, label: copy.layerRisk },
          ] as Array<{ value: IntelLayer; icon: typeof Sprout; label: string }>).map((tab) => {
            const Icon = tab.icon;
            const active = layer === tab.value;
            return (
              <button key={tab.value} type="button" role="tab" aria-selected={active} onClick={() => setLayer(tab.value)} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", active ? "bg-[#47763d] text-white shadow-sm" : "text-[var(--text-secondary)] hover:bg-[var(--surface-default)]")}>
                <Icon size={13} aria-hidden="true" />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[420px]">
        {dataset && (
          <Suspense
            fallback={
              <div className="absolute inset-0 grid min-h-[420px] place-items-center">
                <LoadingSkeleton variant="chart" label="Loading agriculture map" />
              </div>
            }
          >
            <GlobalVectorMap
              dataset={dataset}
              className="absolute inset-0 min-h-[420px]"
              ariaLabel={copy.mapTitle}
              overlayFillOpacity={0.72}
              overlayHoverOpacity={0.2}
              overlaySelectedOpacity={0.18}
              activeMetricLayer={layer}
              fillColorsByCanonicalId={fillColors}
              topCanonicalLocationIds={townships.filter((point) => point.densityBand === "high" && point.canonicalId).map((point) => point.canonicalId as string)}
              selectedCanonicalLocationId={selected?.canonicalId ?? null}
              onFeatureClick={(feature) => {
                const canonicalId = String(feature.properties.canonical_location_id ?? "");
                onSelect(byCanonical.get(canonicalId) ?? null);
              }}
              onMapBackgroundClick={() => onSelect(null)}
            />
          </Suspense>
        )}

        {layer === "density" && (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-[var(--border-default)] bg-white/95 p-3 shadow-[var(--shadow-card)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{copy.densityLegend}</p>
            <ul className="mt-2 space-y-1.5 text-[10px] text-[var(--text-secondary)]">
              {([
                { color: DENSITY_COLORS.high, label: copy.densityHigh },
                { color: DENSITY_COLORS.medium, label: copy.densityMedium },
                { color: DENSITY_COLORS.low, label: copy.densityLow },
                { color: DENSITY_COLORS.none, label: copy.densityNone },
              ] as Array<{ color: string; label: string }>).map((item) => (
                <li key={item.label} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: item.color }} />{item.label}</li>
              ))}
            </ul>
          </div>
        )}

        {opportunityEmpty && (
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-xl border border-dashed border-[var(--border-default)] bg-white/95 p-4 text-center shadow-sm">
            <Tractor size={16} className="mx-auto text-[var(--text-tertiary)]" aria-hidden="true" />
            <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{copy.opportunityEmpty}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-[var(--text-secondary)]">{copy.opportunityEmptyHelp}</p>
          </div>
        )}
        {riskEmpty && (
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-xl border border-dashed border-[var(--border-default)] bg-white/95 p-4 text-center shadow-sm">
            <CloudLightning size={16} className="mx-auto text-[var(--text-tertiary)]" aria-hidden="true" />
            <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{copy.riskEmpty}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-[var(--text-secondary)]">{copy.riskEmptyHelp}</p>
          </div>
        )}
      </div>

      {selected && layer !== "density" && (
        <div className="border-t border-[var(--divider)] px-5 py-3 text-[11px] text-[var(--text-secondary)] sm:px-6">
          <span className="font-semibold text-[var(--text-primary)]">{selected.name}</span>
          {layer === "crop" && selected.mainCropName && <> · {copy.layerCropType}: {agricultureCropName(selected.mainCropName, selected.mainCropCode ?? "", language)}</>}
          {layer === "opportunity" && selected.opportunityCount > 0 && <> · {copy.opportunityBadge}: {selected.opportunityLevel}</>}
          {layer === "risk" && selected.hazardCount > 0 && <><span className="ml-1 inline-flex items-center rounded-full border border-[#f3cfb8] bg-[#fdf0e7] px-2 py-0.5 text-[10px] font-bold text-[#b45309]">{copy.hazardHistorical}</span> · {selected.hazardCount}</>}
        </div>
      )}
    </section>
  );
}

function stableIndex(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % CROP_COLORS.length;
}
