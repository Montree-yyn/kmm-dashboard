"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RotateCcw, Search, X } from "lucide-react";
import type { Map as MapLibreMap, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import redZoneData from "./red-zone-data.json";

type SourceRiskStatus = "red" | "safe";
type TownshipStatus = "red" | "not-listed";
type RiskTownship = { name: string; state: string; status: SourceRiskStatus };
type RedItem = { name: string; sources: string[] };
type StateList = { red: RedItem[]; safe: string[] };
type Unmatched = { name: string; note: string };
type RedZoneData = {
  rawTotal: number;
  stateOrder?: string[];
  townships: RiskTownship[];
  stateTownLists: Record<string, StateList>;
  unmatchedByState: Record<string, Unmatched[]>;
  excelCountsByState: Record<string, number>;
  displayName: Record<string, string>;
};

type SearchItem = { name: string; state: string; status: TownshipStatus; note?: string };

type GeoJsonFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
};
type GeoJsonCollection = { type: "FeatureCollection"; features: GeoJsonFeature[] };

const DATA = redZoneData as RedZoneData;
const STATE_ORDER = DATA.stateOrder ?? Object.keys(DATA.stateTownLists);
const MYANMAR_BOUNDS: [[number, number], [number, number]] = [[92.15, 9.55], [101.2, 28.6]];
const RISK_COLORS: Record<TownshipStatus, string> = {
  red: "#9F2D24",
  "not-listed": "#E4E1DB",
};


function norm(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function groupState(value = "") {
  const n = norm(value);
  if (n.startsWith("bago")) return "Bago";
  if (n.startsWith("shan")) return "Shan";
  if (n === "sagaing" || n === "saigang") return "Saigang";
  if (n === "tanintharyi" || n === "tanitharyi") return "Tanitharyi";
  return value.replace(/\s+(State|Region|Division)$/i, "").trim();
}

function townshipStatusFor(status: SourceRiskStatus): TownshipStatus {
  return status === "red" ? "red" : "not-listed";
}

function sourceTownshipFromNote(note = "") {
  const match = note.match(/(?:town|area) within ([A-Za-z -]+?) Township/i);
  return match?.[1]?.trim() ?? null;
}

function townshipKey(state: string, township: string) {
  const cleanedTownship = norm(township).replace(/panghkam/g, "");
  return `${groupState(state)}|${cleanedTownship}`;
}

function featureTownship(properties: Record<string, unknown>) {
  return String(properties.TS ?? properties.township ?? properties.name ?? "");
}

function featureState(properties: Record<string, unknown>) {
  return String(properties.ST ?? properties.state_region ?? properties.state ?? "");
}

function collectCoords(input: unknown, result: [number, number][] = []) {
  if (!Array.isArray(input)) return result;
  if (input.length >= 2 && typeof input[0] === "number" && typeof input[1] === "number") {
    result.push([input[0], input[1]]);
    return result;
  }
  input.forEach((child) => collectCoords(child, result));
  return result;
}

function boundsForFeatures(features: GeoJsonFeature[]) {
  const points = features.flatMap((f) => collectCoords(f.geometry?.coordinates));
  if (!points.length) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]] as [[number, number], [number, number]];
}

const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#F3F1ED" } }],
};

export default function MyanmarMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geoRef = useRef<GeoJsonCollection | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedTownship, setSelectedTownship] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<SearchItem | null>(null);
  const [query, setQuery] = useState("");

  const riskByKey = useMemo(() => new Map(DATA.townships.map((t) => [townshipKey(t.state, t.name), t.status])), []);
  const redTownshipCount = useMemo(() => Object.values(DATA.stateTownLists).reduce((sum, item) => sum + item.red.length, 0), []);
  const unmatchedCount = useMemo(() => Object.values(DATA.unmatchedByState).reduce((sum, rows) => sum + rows.length, 0), []);
  const affectedStates = useMemo(() => Object.entries(DATA.stateTownLists).filter(([, v]) => v.red.length > 0).length, []);

  const stateStats = useMemo(() => STATE_ORDER.map((state) => {
    const list = DATA.stateTownLists[state] ?? { red: [], safe: [] };
    const total = list.red.length + list.safe.length;
    return { state, red: list.red.length, total, ratio: total ? list.red.length / total : 0 };
  }).sort((a, b) => b.ratio - a.ratio || b.red - a.red), []);

  const searchIndex = useMemo<SearchItem[]>(() => {
    const mapped = DATA.townships.map((t) => ({ name: t.name, state: t.state, status: townshipStatusFor(t.status) }));
    const unmatched = Object.entries(DATA.unmatchedByState).flatMap(([state, rows]) => rows.map((r) => ({ name: r.name, state, status: "red" as const, note: r.note })));
    return [...mapped, ...unmatched];
  }, []);

  const searchResults = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    return searchIndex.filter((item) => norm(item.name).includes(q) || norm(DATA.displayName[item.state] ?? item.state).includes(q)).slice(0, 20);
  }, [query, searchIndex]);

  const updateSelection = useCallback((state: string | null, township: string | null = null) => {
    setSelectedState(state);
    setSelectedTownship(township);
    setSelectedArea(null);
    const map = mapRef.current;
    const geo = geoRef.current;
    if (!map || !geo || !map.getLayer("state-selected")) return;
    if (!state) {
      map.setFilter("state-selected", ["==", ["get", "risk_state"], "__none__"] as never);
      map.setFilter("township-selected", ["==", ["get", "risk_key"], "__none__"] as never);
      map.fitBounds(MYANMAR_BOUNDS, { padding: 32, duration: 450 });
      return;
    }
    map.setFilter("state-selected", ["==", ["get", "risk_state"], state] as never);
    map.setFilter("township-selected", township ? ["==", ["get", "risk_key"], townshipKey(state, township)] as never : ["==", ["get", "risk_key"], "__none__"] as never);
    const matching = geo.features.filter((f) => String(f.properties.risk_state) === state && (!township || String(f.properties.risk_key) === townshipKey(state, township)));
    const bounds = boundsForFeatures(matching.length ? matching : geo.features.filter((f) => String(f.properties.risk_state) === state));
    if (bounds) map.fitBounds(bounds, { padding: township ? 110 : 62, maxZoom: township ? 9 : 7, duration: 500 });
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
    let disposed = false;
    let map: MapLibreMap | null = null;
    async function init() {
      try {
        const [{ default: maplibregl }, townshipsResponse] = await Promise.all([
          import("maplibre-gl"),
          fetch("/maps/myanmar-townships.geojson", { cache: "force-cache" }),
        ]);
        if (!townshipsResponse.ok) throw new Error(`Township map ${townshipsResponse.status}`);
        const geo = await townshipsResponse.json() as GeoJsonCollection;
        geo.features.forEach((feature) => {
          const township = featureTownship(feature.properties);
          const rawState = featureState(feature.properties);
          const state = groupState(rawState);
          const key = townshipKey(state, township);
          const status = riskByKey.get(key) ?? "safe";
          feature.properties = { ...feature.properties, risk_state: state, risk_key: key, risk_status: townshipStatusFor(status) };
        });
        geoRef.current = geo;
        if (disposed || !mapContainer.current) return;
        map = new maplibregl.Map({ container: mapContainer.current, style: STYLE, bounds: MYANMAR_BOUNDS, fitBoundsOptions: { padding: 28 }, attributionControl: false });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          if (!map || disposed) return;
          map.addSource("townships", { type: "geojson", data: geo as never, promoteId: "risk_key" });
          map.addLayer({ id: "township-fill", type: "fill", source: "townships", paint: { "fill-color": ["match", ["get", "risk_status"], "red", RISK_COLORS.red, "not-listed", RISK_COLORS["not-listed"], RISK_COLORS["not-listed"]] as never, "fill-opacity": 0.94 } });
          map.addLayer({ id: "township-line", type: "line", source: "townships", paint: { "line-color": "#F4F0E9", "line-width": 0.5, "line-opacity": 0.58 } });
          map.addLayer({ id: "state-selected", type: "line", source: "townships", filter: ["==", ["get", "risk_state"], "__none__"], paint: { "line-color": "#B9473C", "line-width": 3, "line-opacity": 0.95 } });
          map.addLayer({ id: "township-selected", type: "line", source: "townships", filter: ["==", ["get", "risk_key"], "__none__"], paint: { "line-color": "#7A211B", "line-width": 4, "line-opacity": 1 } });

          // HTML labels avoid external glyph dependencies and keep names visible on the vector map.
          const stateGroups = new Map<string, GeoJsonFeature[]>();
          geo.features.forEach((feature) => {
            const state = String(feature.properties.risk_state ?? "");
            if (!state) return;
            const list = stateGroups.get(state) ?? [];
            list.push(feature);
            stateGroups.set(state, list);
          });

          const stateLabels: HTMLElement[] = [];
          const townshipLabels: HTMLElement[] = [];
          const makeLabel = (text: string, kind: "state" | "township") => {
            const el = document.createElement("div");
            el.textContent = text;
            el.style.pointerEvents = "none";
            el.style.userSelect = "none";
            el.style.whiteSpace = "nowrap";
            el.style.fontFamily = "var(--font-body), Inter, system-ui, sans-serif";
            el.style.fontWeight = kind === "state" ? "700" : "500";
            el.style.fontSize = kind === "state" ? "12px" : "8px";
            el.style.letterSpacing = kind === "state" ? "0.01em" : "0";
            el.style.color = kind === "state" ? "#374151" : "#5F6770";
            el.style.textShadow = "0 1px 0 rgba(255,255,255,.96), 1px 0 0 rgba(255,255,255,.9), -1px 0 0 rgba(255,255,255,.9), 0 -1px 0 rgba(255,255,255,.9)";
            el.style.opacity = kind === "state" ? "0.9" : "0.74";
            el.style.transform = "translateZ(0)";
            return el;
          };

          stateGroups.forEach((features, state) => {
            const bounds = boundsForFeatures(features);
            if (!bounds) return;
            const center: [number, number] = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
            const el = makeLabel(DATA.displayName[state] ?? state, "state");
            stateLabels.push(el);
            new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(center).addTo(map!);
          });

          geo.features.forEach((feature) => {
            const township = featureTownship(feature.properties);
            if (!township) return;
            const bounds = boundsForFeatures([feature]);
            if (!bounds) return;
            const center: [number, number] = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
            const el = makeLabel(township, "township");
            townshipLabels.push(el);
            new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(center).addTo(map!);
          });

          const updateLabelVisibility = () => {
            const zoom = map?.getZoom() ?? 0;
            stateLabels.forEach((el) => {
              el.style.display = zoom < 6.25 ? "block" : "none";
            });
            townshipLabels.forEach((el) => {
              el.style.display = zoom >= 5.6 ? "block" : "none";
              el.style.fontSize = zoom >= 8 ? "8.5px" : "8px";
            });
          };
          updateLabelVisibility();
          map.on("zoom", updateLabelVisibility);
          map.on("mousemove", "township-fill", () => { if (map) map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "township-fill", () => { if (map) map.getCanvas().style.cursor = ""; });
          map.on("click", "township-fill", (event) => {
            const feature = event.features?.[0] as MapGeoJSONFeature | undefined;
            if (!feature?.properties) return;
            const state = String(feature.properties.risk_state ?? "");
            const township = featureTownship(feature.properties as Record<string, unknown>);
            updateSelection(state, township);
          });
          setMapReady(true);
        });
      } catch (error) {
        if (!disposed) setMapError(error instanceof Error ? error.message : "ไม่สามารถโหลดแผนที่ได้");
      }
    }
    void init();
    return () => { disposed = true; map?.remove(); mapRef.current = null; };
  }, [riskByKey, updateSelection]);

  const selectedList = selectedState ? DATA.stateTownLists[selectedState] ?? { red: [], safe: [] } : null;
  const selectedUnmatched = selectedState ? DATA.unmatchedByState[selectedState] ?? [] : [];

  function handleChooseSearch(item: SearchItem) {
    setQuery(item.name);
    updateSelection(item.state, item.note ? sourceTownshipFromNote(item.note) : item.name);
    if (item.note) setSelectedArea(item);
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] p-4 sm:p-5 xl:p-6">
      <div className="mx-auto max-w-[1680px] space-y-4">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-600)]">Executive Risk Briefing</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">แผนที่พื้นที่เสี่ยงในเมียนมา (Red Zone Map)</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">แสดง Township ที่ถูกระบุเป็นพื้นที่เสี่ยงสูง แยกตามรัฐ/ภูมิภาค โดยใช้รูปแบบ Vector Map เดียวกับระบบ Marketing</p>
          </div>
          <div className="text-right text-[11px] leading-5 text-[var(--text-tertiary)]">แหล่งข้อมูล: <b className="text-[var(--text-secondary)]">Red_Zone_Summary_Consolidated.xlsx</b><br/>Red Zone list · Insecure Areas list · Additional list</div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [String(DATA.rawTotal), "รายการในข้อมูลต้นฉบับ"],
            [String(redTownshipCount), "Township Red Zone ที่จับคู่ได้"],
            [String(affectedStates), "รัฐ/ภูมิภาคที่มี Red Zone"],
            [String(unmatchedCount), "พื้นที่ย่อยที่ยังไม่มี boundary"],
          ].map(([value, label], index) => <div key={label} className="rounded-[16px] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)]"><p className={`text-2xl font-bold tabular-nums ${index === 1 ? "text-[#9F2D24]" : "text-[var(--text-primary)]"}`}>{value}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{label}</p></div>)}
        </section>

        <section className="grid min-h-[690px] gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,.8fr)]">
          <div className="flex min-h-[690px] flex-col overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] p-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16}/>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา State / Township / Village..." className="h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-default)] pl-10 pr-3 text-sm outline-none focus:border-[var(--brand-400)] focus:ring-2 focus:ring-[var(--brand-focus)]" />
                {query.trim() && <div className="absolute left-0 right-0 top-[48px] z-30 max-h-72 overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-default)] p-1.5 shadow-[var(--shadow-floating)]">{searchResults.length ? searchResults.map((item) => <button key={`${item.state}-${item.name}`} type="button" onClick={() => handleChooseSearch(item)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]"><span><b>{item.name}</b><span className="ml-2 text-xs text-[var(--text-tertiary)]">{DATA.displayName[item.state] ?? item.state}</span></span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === "red" ? "bg-[#F6D7D2] text-[#7A211B]" : "bg-[#E4E1DB] text-[var(--text-secondary)]"}`}>{item.status === "red" ? "Red Zone" : "Not Listed"}</span></button>) : <p className="p-3 text-sm text-[var(--text-tertiary)]">ไม่พบผลลัพธ์</p>}</div>}
              </div>
              <button type="button" onClick={() => { setQuery(""); updateSelection(null); }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"><RotateCcw size={16}/>ดูทั้งประเทศ</button>
            </div>
            <div className="relative min-h-0 flex-1 bg-[#F3F1ED] kmm-marketing-map">
              <div ref={mapContainer} className="absolute inset-0" aria-label="Myanmar Red Zone interactive map"/>
              {!mapReady && !mapError && <div className="absolute inset-0 grid place-items-center bg-[#F3F1ED]/80 text-sm font-semibold text-[var(--text-secondary)]">กำลังโหลด Vector Map…</div>}
              {mapError && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-semibold text-[#7A211B]">โหลดแผนที่ไม่สำเร็จ: {mapError}</div>}
              <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-3 rounded-xl border border-white/80 bg-white/92 px-3 py-2 text-[11px] text-[#4B5563] shadow-sm backdrop-blur"><span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-[#9F2D24]"/>Red Zone</span><span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-[#E4E1DB]"/>Not Listed · ไม่มีรายชื่อใน Red Zone</span><span className="flex items-center gap-1.5"><i className="size-3 rounded-sm border-2 border-[#7A211B] bg-transparent"/>พื้นที่ที่เลือก</span></div>
            </div>
          </div>

          <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(300px,.9fr)_minmax(330px,1.1fr)]">
            <div className="overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]">
              <div className="border-b border-[var(--border-subtle)] px-4 py-3"><h2 className="text-sm font-bold text-[var(--text-primary)]">เลือกพื้นที่ · Region / State</h2><p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">เรียงตามสัดส่วน Red Zone ของพื้นที่</p></div>
              <div className="grid max-h-[340px] grid-cols-2 gap-2 overflow-auto p-3">
                {stateStats.map((item, index) => <button key={item.state} type="button" onClick={() => updateSelection(item.state)} className={`rounded-xl border p-2.5 text-left transition ${selectedState === item.state ? "border-[#B9473C] bg-[#F6D7D2]" : "border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--surface-subtle)]"}`}><div className="flex items-center gap-2"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--surface-subtle)] text-[10px] font-bold text-[var(--text-tertiary)]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--text-primary)]">{DATA.displayName[item.state] ?? item.state}</span><span className="text-xs font-bold text-[#9F2D24]">{item.red}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E4E1DB]"><div className="h-full rounded-full bg-[#9F2D24]" style={{ width: `${Math.round(item.ratio * 100)}%` }}/></div><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{Math.round(item.ratio * 100)}% · {item.total} townships</p></button>)}
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3"><div><h2 className="text-sm font-bold text-[var(--text-primary)]">{selectedState ? DATA.displayName[selectedState] ?? selectedState : "รายละเอียด"}</h2>{selectedTownship && <p className="text-[11px] font-semibold text-[var(--brand-600)]">เลือก: {selectedTownship}</p>}</div>{selectedState && <button type="button" onClick={() => updateSelection(null)} className="grid size-9 place-items-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-subtle)]" aria-label="ล้างพื้นที่"><X size={16}/></button>}</div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                {!selectedList ? <div className="grid h-full min-h-44 place-items-center text-center"><div><AlertTriangle className="mx-auto mb-2 text-[var(--text-tertiary)]" size={22}/><p className="text-sm text-[var(--text-tertiary)]">เลือกรัฐบนแผนที่หรือจากรายการ<br/>เพื่อดู Township แบบละเอียด</p></div></div> : <>
                  <div className="mb-4 grid gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3 text-xs sm:grid-cols-3">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">State / Region</p><p className="mt-1 font-bold text-[var(--text-primary)]">{DATA.displayName[selectedState!] ?? selectedState}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Township</p><p className="mt-1 font-bold text-[var(--text-primary)]">{selectedTownship ?? "—"}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Village / Area</p><p className="mt-1 font-bold text-[var(--text-primary)]">{selectedArea?.name ?? "—"}</p></div>
                    {selectedArea?.note && <p className="sm:col-span-3 text-[11px] leading-5 text-[var(--text-secondary)]">ข้อมูลต้นฉบับ: {selectedArea.note}</p>}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">Red Zone <b className="text-[#9F2D24]">{selectedList.red.length}</b> จาก {selectedList.red.length + selectedList.safe.length} Township ({selectedList.red.length + selectedList.safe.length ? Math.round(selectedList.red.length / (selectedList.red.length + selectedList.safe.length) * 100) : 0}%)</p>
                  <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Township Red Zone ({selectedList.red.length})</p>
                  <div className="flex flex-wrap gap-1.5">{selectedList.red.length ? selectedList.red.map((item) => <button key={item.name} type="button" onClick={() => updateSelection(selectedState!, item.name)} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${selectedTownship === item.name ? "border-[#7A211B] bg-[#9F2D24] text-white" : "border-[#B9473C] bg-[#F6D7D2] text-[#7A211B] hover:border-[#9F2D24]"}`}>{item.name}</button>) : <span className="text-xs text-[var(--text-tertiary)]">ไม่มี Township ในลิสต์ Red Zone</span>}</div>
                  {!!selectedUnmatched.length && <><p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">พื้นที่เพิ่มเติมที่ยังไม่มี boundary ({selectedUnmatched.length})</p><div className="space-y-1.5">{selectedUnmatched.map((item) => <div key={item.name} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-2 text-xs text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">{item.name}</b> — {item.note}</div>)}</div></>}
                  {!!selectedList.safe.length && <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-[var(--text-secondary)]">Not Listed · Township ที่ไม่มีรายชื่อใน Red Zone ({selectedList.safe.length})</summary><div className="mt-2 flex flex-wrap gap-1.5">{selectedList.safe.map((name) => <span key={name} className="rounded-lg border border-[var(--border-default)] bg-[#E4E1DB] px-2 py-1 text-xs text-[var(--text-secondary)]">{name}</span>)}</div></details>}
                </>}
              </div>
            </div>
          </div>
        </section>

        <footer className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-default)] px-4 py-3 text-[11px] leading-5 text-[var(--text-tertiary)]"><b className="text-[var(--text-secondary)]">หมายเหตุข้อมูล:</b> สถานะ “Red Zone” อ้างอิงจากรายชื่อในไฟล์ Excel ที่แนบมาและแหล่งข้อมูลภายใน ไม่ใช่ประกาศอย่างเป็นทางการจากหน่วยงานรัฐ และอาจเปลี่ยนแปลงตามสถานการณ์จริง พื้นที่ที่ “ไม่มีรายชื่อ” หมายถึงไม่ปรากฏในข้อมูลที่ให้มา ไม่ได้ยืนยันว่าปลอดภัย 100% · รายการต้นฉบับ {DATA.rawTotal} รายการ · จับคู่ Township ได้ {redTownshipCount} แห่ง · พื้นที่ย่อยที่ยังไม่มีขอบเขต {unmatchedCount} แห่ง · Boundary: geoBoundaries.org / Myanmar Analytics Project (CC BY 4.0)</footer>
      </div>
    </main>
  );
}
