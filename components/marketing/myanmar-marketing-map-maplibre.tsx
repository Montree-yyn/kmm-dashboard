"use client";

import { useMemo, useState } from "react";
import townshipMaster from "../../data/master-townships.json";
import { getMapDataset } from "../../lib/maps/datasets";
import { normalizeLocation } from "../../lib/marketing/location-mapping";
import { cn } from "../../lib/utils";
import { GlobalVectorMap } from "../maps/global-vector-map";
import { MyanmarTownshipDetailPanel, type MyanmarMarketingMapProps, type TownshipMetric } from "./myanmar-marketing-map";

type MasterTownship = { township_id: string; township: string; state_region: string };
const master = townshipMaster as MasterTownship[];
const dataset = getMapDataset("mm-townships-pmtiles");

export function MyanmarMarketingMapMapLibre({ townshipMetrics = {}, className }: MyanmarMarketingMapProps) {
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string | null>(null);
  const metricById = useMemo(() => {
    const result = new Map<string, TownshipMetric>();
    for (const record of master) {
      const metric = townshipMetrics[normalizeLocation(record.township)];
      if (metric && normalizeLocation(metric.stateRegion) === normalizeLocation(record.state_region)) result.set(record.township_id, metric);
    }
    return result;
  }, [townshipMetrics]);
  const fillColors = useMemo(() => Object.fromEntries(Array.from(metricById, ([id, metric]) => [id, metric.fill])), [metricById]);
  const selectedMetric = selectedCanonicalId ? metricById.get(selectedCanonicalId) ?? null : null;
  if (!dataset) return <div className={cn("grid h-full place-items-center text-sm text-red-700", className)}>Myanmar PMTiles dataset is not configured.</div>;
  return <div className={cn("kmm-marketing-map relative h-full w-full min-w-0 overflow-hidden bg-[#F8FAFC]", className)}><GlobalVectorMap dataset={dataset} className="absolute inset-0" ariaLabel="Interactive Myanmar township heatmap" fillColorsByCanonicalId={fillColors} selectedCanonicalLocationId={selectedCanonicalId} onFeatureClick={(feature) => { const id = String(feature.properties.canonical_location_id ?? ""); if (id && metricById.has(id)) setSelectedCanonicalId(id); }} />{selectedMetric && <div className="kmm-township-detail-overlay absolute inset-y-0 right-0 z-10 hidden w-[420px] max-w-[calc(100%-24px)] border-l border-[#EEF0F3] bg-white shadow-[-12px_0_30px_rgba(31,41,55,0.12)] md:block"><MyanmarTownshipDetailPanel metric={selectedMetric} onClose={() => setSelectedCanonicalId(null)} /></div>}</div>;
}
