"use client";

import { useEffect, useState } from "react";
import { getMapDataset } from "../../lib/maps/datasets";
import type { MapDatasetConfig } from "../../lib/maps/types";
import { GlobalVectorMap } from "./global-vector-map";

const geojsonDataset = getMapDataset("mm-townships-geojson")!;
const pmtilesDataset = getMapDataset("mm-townships-pmtiles")!;

export function VectorMapPreview() {
  const [dataset, setDataset] = useState<MapDatasetConfig>(geojsonDataset);
  const [selection, setSelection] = useState<Record<string, unknown> | null>(null);
  const [availability, setAvailability] = useState("checking");
  useEffect(() => { let active = true; fetch(dataset.url, { method: "HEAD" }).then((response) => active && setAvailability(response.ok ? "available" : `unavailable (${response.status})`)).catch(() => active && setAvailability("unavailable")); return () => { active = false; }; }, [dataset]);
  return <main className="mx-auto max-w-6xl space-y-4 p-6 text-slate-800"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">Development Preview</p><h1 className="mt-1 text-2xl font-bold">Global Vector Map Foundation</h1><p className="mt-1 text-sm text-slate-600">Myanmar · {dataset.id} · {dataset.dataset_type} · layer: {dataset.source_layer ?? "n/a"} · file: {availability}</p></div><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setDataset(geojsonDataset); setSelection(null); }}>Myanmar GeoJSON</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setDataset(pmtilesDataset); setSelection(null); }}>Myanmar PMTiles</button></div></div><GlobalVectorMap dataset={dataset} onFeatureClick={(feature) => setSelection(feature.properties)} />{selection && <section className="rounded-xl border bg-white p-4 text-sm"><h2 className="font-semibold">Selected township</h2><dl className="mt-2 grid gap-1 sm:grid-cols-2"><div><dt className="text-slate-500">Township</dt><dd>{String(selection.TS ?? selection.location_name ?? "Unavailable")}</dd></div><div><dt className="text-slate-500">Canonical location ID</dt><dd>{String(selection.canonical_location_id ?? "Unavailable")}</dd></div><div><dt className="text-slate-500">State / Region</dt><dd>{String(selection.ST ?? selection.state_region ?? "Unavailable")}</dd></div></dl></section>}</main>;
}
