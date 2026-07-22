"use client";

import { useEffect, useState } from "react";
import { getMapDataset } from "../../lib/maps/datasets";
import { useMapLayerManager } from "../../lib/maps/layer-manager";
import type { MapDatasetConfig } from "../../lib/maps/types";
import { GlobalVectorMap } from "./global-vector-map";

const geojsonDataset = getMapDataset("mm-townships-geojson")!;
const pmtilesDataset = getMapDataset("mm-townships-pmtiles")!;

export function VectorMapPreview() {
  const [dataset, setDataset] = useState<MapDatasetConfig>(geojsonDataset);
  const [selection, setSelection] = useState<Record<string, unknown> | null>(null);
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string | null>(null);
  const [availability, setAvailability] = useState("checking");
  const layerManager = useMapLayerManager();
  useEffect(() => { let active = true; fetch(dataset.url, { method: "HEAD" }).then((response) => active && setAvailability(response.ok ? "available" : `unavailable (${response.status})`)).catch(() => active && setAvailability("unavailable")); return () => { active = false; }; }, [dataset]);
  return <main className="mx-auto max-w-6xl space-y-4 p-6 text-slate-800"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">Development Preview</p><h1 className="mt-1 text-2xl font-bold">Global Vector Map Foundation</h1><p className="mt-1 text-sm text-slate-600">Myanmar · {dataset.id} · {dataset.dataset_type} · layer: {dataset.source_layer ?? "n/a"} · file: {availability}</p></div><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setDataset(geojsonDataset); setSelection(null); setSelectedCanonicalId(null); }}>Myanmar GeoJSON</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setDataset(pmtilesDataset); setSelection(null); setSelectedCanonicalId(null); }}>Myanmar PMTiles</button></div></div><section className="rounded-xl border bg-white p-4"><h2 className="text-sm font-semibold">Map layers</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{layerManager.controls.map((layer) => <label key={layer.id} className="flex items-start gap-2 rounded border border-slate-200 p-3 text-sm"><input type="checkbox" checked={layerManager.layerState[layer.id]} onChange={() => layerManager.toggle(layer.id)} /><span><span className="block font-medium">{layer.label}</span><span className="block text-xs text-slate-500">{layer.functional ? "Active in Sprint 1" : "Placeholder — no business data connected"}</span></span></label>)}</div></section><GlobalVectorMap dataset={dataset} layerState={layerManager.layerState} selectedCanonicalLocationId={selectedCanonicalId} onFeatureClick={(feature) => { setSelection(feature.properties); setSelectedCanonicalId(String(feature.properties.canonical_location_id ?? "") || null); }} />{selection && <section className="rounded-xl border bg-white p-4 text-sm"><h2 className="font-semibold">Selected township</h2><dl className="mt-2 grid gap-1 sm:grid-cols-2"><div><dt className="text-slate-500">Township</dt><dd>{String(selection.TS ?? selection.location_name ?? "Unavailable")}</dd></div><div><dt className="text-slate-500">Canonical location ID</dt><dd>{String(selection.canonical_location_id ?? "Unavailable")}</dd></div><div><dt className="text-slate-500">State / Region</dt><dd>{String(selection.ST ?? selection.state_region ?? "Unavailable")}</dd></div></dl></section>}</main>;
}
