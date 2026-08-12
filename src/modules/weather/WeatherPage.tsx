"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Sprout,
  Thermometer,
  TriangleAlert,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useLocale } from "../../hooks/useLocale";
import { weatherAlerts, weatherLocations } from "./data/weather.mock";
import type {
  WeatherCondition,
  WeatherLocation,
  WeatherRiskLevel,
} from "./weather.types";

type Scope = "myanmar" | "thailand" | "all";

const scopes: Array<{ value: Scope; label: string; count: number }> = [
  {
    value: "myanmar",
    label: "Myanmar",
    count: weatherLocations.filter((location) => location.country === "Myanmar").length,
  },
  {
    value: "thailand",
    label: "Thailand · Tak",
    count: weatherLocations.filter((location) => location.country === "Thailand").length,
  },
  { value: "all", label: "All locations", count: weatherLocations.length },
];

const riskMeta: Record<
  WeatherRiskLevel,
  { text: string; background: string; bar: string; label: string }
> = {
  LOW: {
    text: "text-[var(--status-success)]",
    background: "bg-[var(--status-success-bg)]",
    bar: "bg-[var(--status-success)]",
    label: "Low impact",
  },
  MEDIUM: {
    text: "text-[var(--status-warning)]",
    background: "bg-[var(--status-warning-bg)]",
    bar: "bg-[var(--status-warning)]",
    label: "Medium impact",
  },
  HIGH: {
    text: "text-[var(--status-danger)]",
    background: "bg-[var(--status-danger-bg)]",
    bar: "bg-[var(--status-danger)]",
    label: "High impact",
  },
};

const conditionIcons: Record<WeatherCondition, LucideIcon> = {
  Cloudy: Cloud,
  "Partly Cloudy": CloudSun,
  Rain: CloudRain,
  Thunderstorms: CloudLightning,
};

export function WeatherPage() {
  const { t } = useLocale();
  const [scope, setScope] = useState<Scope>("all");
  const [selectedId, setSelectedId] = useState(weatherLocations[0]?.id ?? "");
  const [refreshCount, setRefreshCount] = useState(0);

  const locations = useMemo(
    () =>
      weatherLocations.filter((location) => {
        if (scope === "myanmar") return location.country === "Myanmar";
        if (scope === "thailand") return location.country === "Thailand";
        return true;
      }),
    [scope],
  );
  const selectedLocation =
    locations.find((location) => location.id === selectedId) ?? locations[0];
  const highRiskCount = locations.filter((location) => location.riskLevel === "HIGH").length;
  const averageRain = locations.length
    ? Math.round(locations.reduce((total, location) => total + location.rainfall24h, 0) / locations.length)
    : 0;
  const averageTemperature = locations.length
    ? Math.round((locations.reduce((total, location) => total + location.temperature, 0) / locations.length) * 10) / 10
    : 0;
  const visibleAlerts = weatherAlerts.filter((alert) =>
    alert.locationIds.some((locationId) => locations.some((location) => location.id === locationId)),
  );

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]" data-weather-page>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
        <div className="space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[28px] font-semibold leading-tight sm:text-[30px]">
                  {t("route.weather.title")}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--brand-600)]">
                  <Activity size={12} aria-hidden="true" />
                  Prototype
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                {t("route.weather.subtitle")} · agriculture and field-sales planning signals
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRefreshCount((value) => value + 1)}
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              aria-label="Refresh mock weather snapshot"
            >
              <RefreshCw size={14} aria-hidden="true" />
              {refreshCount ? "Mock refreshed" : "Refresh mock"}
            </button>
          </header>

          <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-label="Weather scope">
            <div className="flex items-start gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand-100)] text-[var(--brand-600)]">
                <MapPinned size={17} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Coverage scope</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Filter all Weather Intelligence signals by operating area.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Weather location scope">
              {scopes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScope(option.value)}
                  aria-pressed={scope === option.value}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    scope === option.value
                      ? "border-[var(--brand-500)] bg-[var(--brand-100)] text-[var(--brand-600)]"
                      : "border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
                  )}
                >
                  {option.label}
                  <span className="kmm-tabular rounded-full bg-white/75 px-1.5 py-0.5 text-[10px]">
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="weather-overview-title">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="weather-overview-title" className="text-[19px] font-semibold">
                  Weather Overview
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {locations.length} monitored locations · select a card to focus detail
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--text-tertiary)]">
                <Summary icon={Thermometer} label="Avg temp" value={averageTemperature + "°C"} />
                <Summary icon={CloudRain} label="Avg rain 24h" value={averageRain + " mm"} />
                <Summary icon={ShieldCheck} label="High risk" value={String(highRiskCount)} />
              </div>
            </div>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 xl:grid-cols-6">
              {locations.map((location) => (
                <WeatherCard
                  key={location.id}
                  location={location}
                  selected={selectedLocation?.id === location.id}
                  onSelect={() => setSelectedId(location.id)}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" aria-label="Weather map and forecast">
            <WeatherMap
              locations={locations}
              selectedId={selectedLocation?.id ?? ""}
              onSelect={setSelectedId}
            />
            <ForecastTable locations={locations} />
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)_minmax(320px,0.9fr)]" aria-label="Weather actions">
            <AgricultureImpact location={selectedLocation} locations={locations} />
            <Alerts alerts={visibleAlerts} locations={locations} onSelect={setSelectedId} />
            <RecommendedActions locations={locations} />
          </section>

          <footer className="flex flex-col gap-1 border-t border-[var(--divider)] pt-4 text-[10px] leading-4 text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
            <span>Source: Phase 1A mock dataset · no live weather API connected.</span>
            <span>Planning aid only; not agronomic or safety advice.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} aria-hidden="true" />
      <span>{label}</span>
      <strong className="kmm-tabular font-semibold text-[var(--text-secondary)]">{value}</strong>
    </span>
  );
}

function WeatherCard({
  location,
  selected,
  onSelect,
}: {
  location: WeatherLocation;
  selected: boolean;
  onSelect: () => void;
}) {
  const risk = riskMeta[location.riskLevel];
  const ConditionIcon = conditionIcons[location.condition];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group min-w-[250px] snap-start rounded-[var(--radius-card)] border bg-[var(--surface-default)] p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-focus)] sm:min-w-0",
        selected ? "border-[var(--brand-500)] shadow-[0_0_0_3px_var(--brand-focus)]" : "border-[var(--border-default)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{location.name}</span>
          <span className="mt-1 block text-[11px] text-[var(--text-tertiary)]">{location.branchCode} · {location.region}</span>
        </span>
        <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase", risk.background, risk.text)}>
          {location.country === "Myanmar" ? "MM" : "TH"}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("grid size-10 place-items-center rounded-xl", risk.background)}>
            <ConditionIcon className={cn("size-5", risk.text)} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xs text-[var(--text-secondary)]">{location.condition}</span>
            <span className="kmm-tabular mt-0.5 block text-2xl font-semibold">{location.temperature}°</span>
          </span>
        </div>
        <span className="kmm-tabular text-right text-xs font-semibold text-[var(--text-secondary)]">
          {location.rainRisk}%
          <span className="mt-0.5 block text-[10px] font-normal text-[var(--text-tertiary)]">rain risk</span>
        </span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
        <span className={cn("block h-full rounded-full", risk.bar)} style={{ width: location.rainRisk + "%" }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--divider)] pt-3">
        <MiniMetric icon={Droplets} label="Rain" value={location.rainfall24h + " mm"} />
        <MiniMetric icon={Thermometer} label="Humidity" value={location.humidity + "%"} />
        <MiniMetric icon={Wind} label="Wind" value={location.windSpeed + " km/h"} />
      </div>
      <div className={cn("mt-3 rounded-lg px-2.5 py-2 text-[11px] font-semibold", risk.background, risk.text)}>
        {risk.label}
      </div>
    </button>
  );
}

function MiniMetric({ icon: Icon, label, value }: { icon?: LucideIcon; label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
        {Icon && <Icon size={11} aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </span>
      <span className="kmm-tabular mt-1 block truncate text-[11px] font-semibold text-[var(--text-secondary)]">{value}</span>
    </span>
  );
}

function WeatherMap({
  locations,
  selectedId,
  onSelect,
}: {
  locations: WeatherLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]" aria-labelledby="weather-map-title">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--divider)] px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-600)]"><MapPinned size={16} aria-hidden="true" /></span>
            <h2 id="weather-map-title" className="text-[19px] font-semibold">Operating Area Map</h2>
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Myanmar and the five Tak districts.</p>
        </div>
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Map placeholder</span>
      </div>
      <div className="p-4 sm:p-6">
        <div className="relative min-h-[360px] overflow-hidden rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[#eaf2ef]">
          <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 65%) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 65%) 1px, transparent 1px)", backgroundSize: "42px 42px" }} aria-hidden="true" />
          <div className="absolute left-[13%] top-[10%] h-[72%] w-[48%] rotate-[-8deg] rounded-[44%_56%_49%_51%] border-2 border-[#8caea0] bg-[#cfe2d8] shadow-inner" aria-label="Myanmar map placeholder" />
          <div className="absolute left-[50%] top-[52%] h-[32%] w-[25%] rotate-[16deg] rounded-[48%_52%_54%_46%] border-2 border-[#8caea0] bg-[#d9e7dc]" aria-label="Thailand Tak map placeholder" />
          <span className="absolute left-[27%] top-[40%] text-xs font-bold tracking-[0.18em] text-[#5a7c70]">MYANMAR</span>
          <span className="absolute left-[53%] top-[72%] text-[10px] font-bold tracking-[0.12em] text-[#5a7c70]">TAK / THAILAND</span>
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => onSelect(location.id)}
              aria-label={location.name + ", " + location.rainRisk + "% rain risk"}
              aria-pressed={selectedId === location.id}
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"
              style={{ left: location.mapX + "%", top: location.mapY + "%" } as CSSProperties}
            >
              <span className={cn("block size-5 rounded-full border-[3px] border-white shadow-md transition group-hover:scale-125", location.riskLevel === "HIGH" ? "bg-[var(--status-danger)]" : location.riskLevel === "MEDIUM" ? "bg-[var(--status-warning)]" : "bg-[var(--status-success)]", selectedId === location.id && "scale-125 ring-4 ring-[var(--brand-focus)]")} />
              <span className={cn("pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-md bg-white/90 px-1.5 py-1 text-[9px] font-bold text-[#42545d] shadow-sm", selectedId === location.id ? "block" : "hidden group-hover:block")}>{location.name}</span>
            </button>
          ))}
          <span className="absolute bottom-3 left-3 rounded-lg border border-white/80 bg-white/85 px-3 py-2 text-[10px] font-semibold text-[#4c625e]">STATIC PREVIEW · LIVE MAP NOT CONNECTED</span>
        </div>
      </div>
    </section>
  );
}

function ForecastTable({ locations }: { locations: WeatherLocation[] }) {
  const days = locations[0]?.forecast ?? [];
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]" aria-labelledby="weather-forecast-title">
      <div className="border-b border-[var(--divider)] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-600)]"><CalendarDays size={16} aria-hidden="true" /></span>
          <h2 id="weather-forecast-title" className="text-[19px] font-semibold">7-Day Forecast</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Rain probability, volume and temperature by location.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="kmm-tabular min-w-[820px] w-full text-left text-xs">
          <caption className="sr-only">Seven-day weather forecast.</caption>
          <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-[140px] border-r border-[var(--divider)] bg-[var(--surface-subtle)] px-4 py-3 font-semibold">Location</th>
              {days.map((day) => <th key={day.date} scope="col" className="min-w-[98px] px-2 py-3 text-center font-semibold"><span className="block text-[11px] text-[var(--text-primary)]">{day.label}</span><span className="mt-0.5 block text-[10px] font-normal text-[var(--text-tertiary)]">{day.weekday}</span></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--divider)]">
            {locations.map((location) => (
              <tr key={location.id} className="hover:bg-[var(--brand-50)]">
                <th scope="row" className="sticky left-0 z-[1] border-r border-[var(--divider)] bg-[var(--surface-default)] px-4 py-3 text-left"><span className="block font-semibold">{location.name}</span><span className="mt-0.5 block text-[10px] font-normal text-[var(--text-tertiary)]">{location.country === "Myanmar" ? "Myanmar" : "Thailand · Tak"}</span></th>
                {location.forecast.map((day) => <td key={day.date} className="px-2 py-3 text-center"><span className={cn("mx-auto block w-fit rounded-full px-1.5 py-0.5 text-[10px] font-bold", day.rainProbability >= 70 ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : day.rainProbability >= 45 ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]" : "bg-[var(--status-success-bg)] text-[var(--status-success)]")}>{day.rainProbability}%</span><span className="mt-1 block text-[10px] text-[var(--text-secondary)]">{day.rainfallMm} mm</span><span className="mt-0.5 block text-[10px] font-semibold">{day.temperatureHigh}° / {day.temperatureLow}°</span></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AgricultureImpact({ location, locations }: { location: WeatherLocation | undefined; locations: WeatherLocation[] }) {
  const rainfall7d = location?.forecast.reduce((total, day) => total + day.rainfallMm, 0) ?? 0;
  const level: WeatherRiskLevel = !location ? "LOW" : rainfall7d >= 150 || location.rainRisk >= 70 ? "HIGH" : rainfall7d >= 50 || location.rainRisk >= 45 ? "MEDIUM" : "LOW";
  const meta = riskMeta[level];
  const counts = locations.reduce((result, item) => {
    const rain = item.forecast.reduce((total, day) => total + day.rainfallMm, 0);
    const itemLevel = rain >= 150 || item.rainRisk >= 70 ? "HIGH" : rain >= 50 || item.rainRisk >= 45 ? "MEDIUM" : "LOW";
    result[itemLevel] += 1;
    return result;
  }, { LOW: 0, MEDIUM: 0, HIGH: 0 } as Record<WeatherRiskLevel, number>);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="weather-agriculture-title">
      <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#edf5e8] text-[#47763d]"><Sprout size={16} aria-hidden="true" /></span><h2 id="weather-agriculture-title" className="text-[19px] font-semibold">Agriculture Impact</h2></div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Rule-based operating signal for the selected location.</p>
      {location ? <div className={cn("mt-5 rounded-[var(--radius-control-lg)] border p-4", meta.background, level === "HIGH" ? "border-[#f3c3be]" : level === "MEDIUM" ? "border-[#f4d6a5]" : "border-[#c9ead5]")}><div className="flex items-start gap-3"><span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-white/80", meta.text)}>{level === "LOW" ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{location.name}</p><span className={cn("rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-bold uppercase", meta.text)}>{meta.label}</span></div><p className="mt-2 text-sm font-semibold">{level === "HIGH" ? "Field access and crop disease risk" : level === "MEDIUM" ? "Plan around wet field windows" : "Normal operating conditions"}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{level === "HIGH" ? "Persistent rain can delay field movement and increase disease pressure." : level === "MEDIUM" ? "Moderate rain may affect outdoor work and crop-input conversations." : "Current rain volume is below the prototype impact threshold."}</p><p className="mt-3 flex items-start gap-1.5 text-xs font-semibold leading-5"><TriangleAlert size={14} className={cn("mt-0.5 shrink-0", meta.text)} />{level === "HIGH" ? "Confirm route access before time-sensitive visits." : level === "MEDIUM" ? "Keep a route backup and prioritize indoor follow-ups." : "Proceed with planned visits and routine checks."}</p></div></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-black/5 pt-3"><MiniMetric label="Rain / 7d" value={rainfall7d + " mm"} /><MiniMetric label="Rain risk" value={location.rainRisk + "%"} /><MiniMetric label="Humidity" value={location.humidity + "%"} /></div></div> : <p className="mt-5 rounded-lg bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">Select a location to see its agriculture signal.</p>}
      <div className="mt-5 grid grid-cols-3 gap-2"><Count label="Low" value={counts.LOW} className="text-[var(--status-success)]" /><Count label="Medium" value={counts.MEDIUM} className="text-[var(--status-warning)]" /><Count label="High" value={counts.HIGH} className="text-[var(--status-danger)]" /></div>
      <p className="mt-4 text-[10px] leading-4 text-[var(--text-tertiary)]">Rule: &gt;150 mm / 7 days or ≥70% rain risk = high; ≥50 mm or ≥45% = medium.</p>
    </section>
  );
}

function Count({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-2.5"><p className="text-[10px] text-[var(--text-tertiary)]">{label}</p><p className={cn("kmm-tabular mt-1 text-xl font-semibold", className)}>{value}</p></div>;
}

function Alerts({ alerts, locations, onSelect }: { alerts: typeof weatherAlerts; locations: WeatherLocation[]; onSelect: (id: string) => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="weather-alerts-title">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger)]"><TriangleAlert size={16} /></span><h2 id="weather-alerts-title" className="text-[19px] font-semibold">Weather Alerts</h2></div><span className="kmm-tabular rounded-full bg-[var(--status-danger-bg)] px-2.5 py-1 text-xs font-bold text-[var(--status-danger)]">{alerts.length}</span></div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Conditions that may change field priorities.</p>
      <div className="mt-5 space-y-3">{alerts.map((alert) => <article key={alert.id} className="rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] p-3.5"><div className="flex items-start gap-3"><span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", alert.severity === "HIGH" ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : "bg-[var(--status-warning-bg)] text-[var(--status-warning)]")}><TriangleAlert size={15} /></span><div className="min-w-0"><p className="text-xs font-semibold">{alert.title}</p><p className="mt-1.5 text-xs leading-5 text-[var(--text-secondary)]">{alert.description}</p><div className="mt-3 flex flex-wrap gap-2"><span className="kmm-tabular rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{alert.metric}</span>{alert.locationIds.map((id) => locations.find((location) => location.id === id)).filter((location): location is WeatherLocation => Boolean(location)).map((location) => <button key={location.id} type="button" onClick={() => onSelect(location.id)} className="rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] hover:text-[var(--brand-600)]">{location.name}</button>)}</div></div></div></article>)}</div>
      {!alerts.length && <p className="mt-5 rounded-lg border border-dashed border-[var(--border-default)] p-5 text-center text-sm text-[var(--text-secondary)]">No alerts in this scope.</p>}
    </section>
  );
}

function RecommendedActions({ locations }: { locations: WeatherLocation[] }) {
  const highRisk = locations.filter((location) => location.riskLevel === "HIGH").length;
  const wetRoutes = locations.filter((location) => location.rainfall24h >= 30).length;
  const actions = [
    { icon: MapPinned, title: "Prioritize route checks", description: "Confirm road and field access before high-risk visits.", count: highRisk + " high-risk areas" },
    { icon: CalendarDays, title: "Re-sequence outdoor activity", description: "Use lower-rain windows for demos and crop visits.", count: wetRoutes + " wet-route areas" },
    { icon: ShieldCheck, title: "Log weather exceptions", description: "Capture weather-driven changes in the daily sales plan.", count: "Planning only" },
  ];
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="weather-actions-title">
      <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#edf1f8] text-[#496a9a]"><ShieldCheck size={16} /></span><h2 id="weather-actions-title" className="text-[19px] font-semibold">Recommended Actions</h2></div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Practical next steps for the current mock signal.</p>
      <div className="mt-5 space-y-2.5">{actions.map((action) => { const Icon = action.icon; return <article key={action.title} className="flex items-start gap-3 rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] p-3.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-600)]"><Icon size={15} /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">{action.title}</p><span className="rounded-full border border-[var(--border-default)] bg-white px-2 py-0.5 text-[9px] font-semibold text-[var(--text-tertiary)]">{action.count}</span></div><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{action.description}</p></div></article>; })}</div>
      <p className="mt-4 text-[10px] leading-4 text-[var(--text-tertiary)]">Phase 1A does not write to Sales, Booking or Team workflows.</p>
    </section>
  );
}
