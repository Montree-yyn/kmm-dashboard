"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Eye,
  Gauge,
  LocateFixed,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Sprout,
  Sun,
  Thermometer,
  TriangleAlert,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useLocale } from "../../hooks/useLocale";
import { weatherLocationSeeds } from "./data/weather.locations";
import { buildWeatherAlerts } from "./data/weather.rules";
import { WeatherMap } from "./WeatherMap";
import { loadLiveWeather, loadWeatherRadar } from "./weather.client";
import type {
  WeatherCondition,
  WeatherAlert,
  WeatherCacheStatus,
  WeatherHourlyPoint,
  WeatherLocation,
  WeatherRadarPayload,
  WeatherRiskLevel,
} from "./weather.types";

type Scope = "myanmar" | "thailand" | "all";

const scopes: Array<{ value: Scope; label: string; count: number }> = [
  {
    value: "myanmar",
    label: "Myanmar",
    count: weatherLocationSeeds.filter((location) => location.country === "Myanmar").length,
  },
  {
    value: "thailand",
    label: "Thailand · Tak",
    count: weatherLocationSeeds.filter((location) => location.country === "Thailand").length,
  },
  { value: "all", label: "All locations", count: weatherLocationSeeds.length },
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
  Clear: Sun,
  Cloudy: Cloud,
  "Partly Cloudy": CloudSun,
  Rain: CloudRain,
  Thunderstorms: CloudLightning,
};

export function WeatherPage() {
  const { t } = useLocale();
  const [scope, setScope] = useState<Scope>("all");
  const [selectedId, setSelectedId] = useState(weatherLocationSeeds[0]?.id ?? "");
  const [liveLocations, setLiveLocations] = useState<WeatherLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<WeatherCacheStatus>("live");
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState(0);
  const [radar, setRadar] = useState<WeatherRadarPayload | null>(null);
  const [radarError, setRadarError] = useState("");

  const loadWeather = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError("");
    const [weatherResult, radarResult] = await Promise.allSettled([
      loadLiveWeather({ forceRefresh }),
      loadWeatherRadar({ forceRefresh }),
    ]);
    if (weatherResult.status === "fulfilled") {
      const payload = weatherResult.value;
      setLiveLocations(payload.locations);
      setLastUpdated(payload.fetchedAt);
      setCacheStatus(payload.cacheStatus);
      setCacheAgeSeconds(payload.cacheAgeSeconds);
    } else {
      setCacheStatus("stale");
      const loadError = weatherResult.reason;
      setError(loadError instanceof Error ? loadError.message : "Unable to load live weather.");
    }
    if (radarResult.status === "fulfilled") {
      setRadar(radarResult.value);
      setRadarError("");
    } else {
      const loadError = radarResult.reason;
      setRadarError(loadError instanceof Error ? loadError.message : "Weather radar is temporarily unavailable.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWeather(false), 0);
    return () => window.clearTimeout(timer);
  }, [loadWeather]);

  const locations = useMemo(
    () =>
      liveLocations.filter((location) => {
        if (scope === "myanmar") return location.country === "Myanmar";
        if (scope === "thailand") return location.country === "Thailand";
        return true;
      }),
    [liveLocations, scope],
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
  const weatherAlerts = useMemo(() => buildWeatherAlerts(liveLocations), [liveLocations]);
  const visibleAlerts = weatherAlerts.filter((alert) =>
    alert.locationIds.some((locationId) => locations.some((location) => location.id === locationId)),
  );
  const initialLoading = loading && liveLocations.length === 0;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]" data-weather-page>
      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-5 xl:p-6">
        <div className="space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[28px] font-semibold leading-tight sm:text-[30px]">
                  {t("route.weather.title")}
                </h1>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                  liveLocations.length && cacheStatus !== "stale"
                    ? "border-[var(--status-success-bg)] bg-[var(--status-success-bg)] text-[var(--status-success)]"
                    : liveLocations.length
                      ? "border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                      : "border-[var(--brand-100)] bg-[var(--brand-50)] text-[var(--brand-600)]",
                )}>
                  <Activity size={12} aria-hidden="true" />
                  {liveLocations.length ? (cacheStatus === "stale" ? "Stale" : "Live") : "Connecting"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                {t("route.weather.subtitle")} · agriculture and field-sales planning signals
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadWeather(true)}
              disabled={loading}
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-wait disabled:opacity-60"
              aria-label="Refresh live weather snapshot"
            >
              <RefreshCw className={cn(loading && "animate-spin motion-reduce:animate-none")} size={14} aria-hidden="true" />
              {loading ? "Refreshing…" : "Refresh live weather"}
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
                    "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
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

          {error && (
            <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between" role="alert">
              <div>
                <p className="font-semibold text-[var(--status-danger)]">Live weather is unavailable</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{error}</p>
              </div>
              <button type="button" onClick={() => void loadWeather(true)} className="min-h-11 w-fit rounded-[var(--radius-control)] border border-[var(--status-danger)] bg-white px-3 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Try again</button>
            </section>
          )}

          {initialLoading ? (
            <WeatherLoadingState />
          ) : liveLocations.length ? (
            <>
              <CurrentConditions
                location={selectedLocation}
                averageTemperature={averageTemperature}
                averageRain={averageRain}
                highRiskCount={highRiskCount}
              />

              <LocationRail
                locations={locations}
                selectedId={selectedLocation?.id ?? ""}
                onSelect={setSelectedId}
              />

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]" aria-label="Live weather radar and selected location forecast">
                <WeatherMap
                  locations={locations}
                  selectedId={selectedLocation?.id ?? ""}
                  onSelect={setSelectedId}
                  radar={radar}
                  radarError={radarError}
                />
                <LocationDetailPanel location={selectedLocation} />
              </section>

              <ForecastTable locations={locations} />

              <section className="grid gap-5 lg:grid-cols-3" aria-label="Weather actions">
                <AgricultureImpact location={selectedLocation} locations={locations} />
                <Alerts alerts={visibleAlerts} locations={locations} onSelect={setSelectedId} />
                <RecommendedActions locations={locations} />
              </section>

              <footer className="flex flex-col gap-1 border-t border-[var(--divider)] pt-4 text-[10px] leading-4 text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
                <span>Forecast: Open-Meteo · radar: {radar ? `RainViewer (${formatRadarCacheStatus(radar.cacheStatus)})` : "unavailable"} · updated {formatUpdatedAt(lastUpdated)} · {formatCacheStatus(cacheStatus, cacheAgeSeconds)}.</span>
                <span>Planning aid only; not agronomic or safety advice.</span>
              </footer>
            </>
          ) : (
            <WeatherEmptyState onRetry={() => void loadWeather(true)} />
          )}
        </div>
      </main>
    </div>
  );
}

function WeatherLoadingState() {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-6 shadow-[var(--shadow-card)]" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <RefreshCw className="animate-spin text-[var(--brand-600)] motion-reduce:animate-none" size={18} aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">Loading live weather</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Requesting current conditions and a seven-day forecast for 11 operating areas.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-hidden="true">
        {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] motion-reduce:animate-none" />)}
      </div>
    </section>
  );
}

function WeatherEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] bg-[var(--surface-default)] p-8 text-center shadow-[var(--shadow-card)]" role="status">
      <CloudRain className="mx-auto text-[var(--brand-600)]" size={28} aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold">No live weather snapshot</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">The dashboard has not received live conditions yet. Try again when the weather provider is reachable.</p>
      <button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-[var(--radius-control)] bg-[var(--brand-600)] px-4 text-xs font-semibold text-white hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Try again</button>
    </section>
  );
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "not available";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatCacheStatus(status: WeatherCacheStatus, ageSeconds: number) {
  if (status === "stale") return `last-known-good (${Math.max(1, Math.floor(ageSeconds / 60))} min old)`;
  if (status === "cached") return `server cache (${Math.max(1, Math.floor(ageSeconds / 60))} min old)`;
  return "live snapshot";
}

function formatRadarCacheStatus(status: WeatherCacheStatus) {
  if (status === "stale") return "cached fallback";
  if (status === "cached") return "cached scan";
  return "live scan";
}

function formatWeatherNumber(value: number) {
  return String(Math.round(value * 10) / 10);
}

function CurrentConditions({
  location,
  averageTemperature,
  averageRain,
  highRiskCount,
}: {
  location: WeatherLocation | undefined;
  averageTemperature: number;
  averageRain: number;
  highRiskCount: number;
}) {
  if (!location) return null;
  const risk = riskMeta[location.riskLevel];
  const ConditionIcon = conditionIcons[location.condition];
  const today = location.forecast[0];

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="weather-overview-title">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="weather-overview-title" className="text-[19px] font-semibold">Current conditions</h2>
            <span className="rounded-full bg-[var(--brand-100)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--brand-600)]">Selected area</span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Weather Overview · choose an operating area below to update the detail view.</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <span className={cn("grid size-14 place-items-center rounded-2xl", risk.background)}>
              <ConditionIcon className={cn("size-8", risk.text)} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Now · {location.name}</p>
              <p className="kmm-tabular text-[44px] font-semibold leading-none tracking-[-0.04em]">{location.temperature}°<span className="ml-1 text-xl font-medium text-[var(--text-secondary)]">C</span></p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{location.condition} · {location.branchCode} · {location.region}</p>
            </div>
            <span className={cn("rounded-xl px-3 py-2 text-xs font-semibold", risk.background, risk.text)}>
              {risk.label}
              <span className="mt-0.5 block text-[10px] font-normal">{location.rainRisk}% rain risk</span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
          <MetricTile icon={CloudRain} label="Avg rain 24h" value={averageRain + " mm"} />
          <MetricTile icon={Thermometer} label="Avg temperature" value={averageTemperature + "°C"} />
          <MetricTile icon={Droplets} label="Rain at area" value={location.rainfall24h + " mm"} />
          <MetricTile icon={ShieldCheck} label="High-risk areas" value={String(highRiskCount)} />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--divider)] pt-4 sm:grid-cols-4">
        <MiniMetric icon={Droplets} label="Rainfall · 24h" value={location.rainfall24h + " mm"} />
        <MiniMetric icon={Thermometer} label="Humidity" value={location.humidity + "%"} />
        <MiniMetric icon={Wind} label="Wind" value={location.windSpeed + " km/h"} />
        <MiniMetric icon={CalendarDays} label="Today high / low" value={today ? `${today.temperatureHigh}° / ${today.temperatureLow}°` : "—"} />
      </div>
    </section>
  );
}

function MetricTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]"><Icon size={12} aria-hidden="true" /><span>{label}</span></div>
      <p className="kmm-tabular mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function LocationRail({ locations, selectedId, onSelect }: { locations: WeatherLocation[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)] sm:p-5" aria-labelledby="weather-locations-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="weather-locations-title" className="text-[17px] font-semibold">Operating areas</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Select a location to focus the radar pin and next 12 hours.</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{locations.length} monitored</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11" aria-label="Weather locations">
        {locations.map((location) => {
          const selected = location.id === selectedId;
          const risk = riskMeta[location.riskLevel];
          return (
            <button
              key={location.id}
              type="button"
              onClick={() => onSelect(location.id)}
              aria-pressed={selected}
              className={cn(
                "min-h-[68px] rounded-[var(--radius-control-lg)] border px-2.5 py-2 text-left transition hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                selected ? "border-[var(--brand-500)] bg-[var(--brand-50)] shadow-[0_0_0_2px_var(--brand-focus)]" : "border-[var(--divider)] bg-[var(--surface-subtle)]",
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="flex min-w-0 items-center gap-1.5"><span className={cn("size-2 shrink-0 rounded-full", risk.bar)} aria-hidden="true" /><span className="truncate text-[11px] font-semibold">{location.name}</span></span>
                <span className="shrink-0 text-[9px] font-bold uppercase text-[var(--text-tertiary)]">{location.country === "Myanmar" ? "MM" : "TH"}</span>
              </span>
              <span className="mt-2 flex items-baseline justify-between gap-1"><span className="kmm-tabular text-lg font-semibold">{location.temperature}°</span><span className="kmm-tabular text-[10px] font-semibold text-[var(--text-secondary)]">{location.rainRisk}% rain</span></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LocationDetailPanel({ location }: { location: WeatherLocation | undefined }) {
  if (!location) {
    return <section className="flex h-[520px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] bg-[var(--surface-default)] p-6 text-sm text-[var(--text-secondary)] md:h-[620px] xl:h-[680px]">Select a location to see hourly detail.</section>;
  }
  const risk = riskMeta[location.riskLevel];
  const ConditionIcon = conditionIcons[location.condition];
  const rainfall7d = location.forecast.reduce((total, day) => total + day.rainfallMm, 0);
  const hourly = location.hourly.slice(0, 12);
  return (
    <section className="flex h-[520px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)] md:h-[620px] xl:h-[680px]" aria-labelledby="weather-detail-title">
      <div className="border-b border-[var(--divider)] px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Selected location</p>
            <h2 id="weather-detail-title" className="mt-1 truncate text-[21px] font-semibold">{location.name}</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{location.country} · {location.region} · {location.branchCode}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", risk.background, risk.text)}>{risk.label.replace(" impact", "")}</span>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className={cn("grid size-12 place-items-center rounded-2xl", risk.background)}><ConditionIcon className={cn("size-6", risk.text)} aria-hidden="true" /></span>
          <div><p className="text-xs text-[var(--text-secondary)]">Current condition</p><p className="kmm-tabular mt-0.5 text-3xl font-semibold">{location.temperature}°C</p></div>
          <div className="ml-auto text-right"><p className="text-xs text-[var(--text-secondary)]">Rain risk</p><p className={cn("kmm-tabular mt-0.5 text-2xl font-semibold", risk.text)}>{location.rainRisk}%</p></div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric icon={Droplets} label="Rain · 24h" value={location.rainfall24h + " mm"} />
          <MiniMetric icon={Wind} label="Wind" value={location.windSpeed + " km/h"} />
          <MiniMetric icon={Thermometer} label="Humidity" value={location.humidity + "%"} />
          <MiniMetric icon={Gauge} label="Rain · 7d" value={formatWeatherNumber(rainfall7d) + " mm"} />
        </div>
        <div className="mt-6">
          <div className="flex items-end justify-between gap-2">
            <div><h3 className="text-sm font-semibold">Next 12 hours</h3><p className="mt-1 text-[11px] text-[var(--text-secondary)]">Rain probability and temperature by hour.</p></div>
            <Clock3 size={15} className="text-[var(--text-tertiary)]" aria-hidden="true" />
          </div>
          {hourly.length ? <div className="mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" aria-label="Hourly weather forecast">{hourly.map((point) => <HourlyForecastTile key={point.time} point={point} />)}</div> : <p className="mt-3 rounded-lg bg-[var(--surface-subtle)] p-3 text-xs text-[var(--text-secondary)]">Hourly detail is not available in this snapshot.</p>}
        </div>
        <div className={cn("mt-5 rounded-[var(--radius-control-lg)] p-4", risk.background)}>
          <div className="flex items-start gap-3"><span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-white/75", risk.text)}><LocateFixed size={15} aria-hidden="true" /></span><div><p className={cn("text-xs font-semibold", risk.text)}>Field access signal</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{location.riskLevel === "HIGH" ? "Observed rain and the forecast suggest confirming route access before outdoor visits." : location.riskLevel === "MEDIUM" ? "Keep a backup route and use lower-rain windows for outdoor work." : "No major weather constraint is indicated for routine field activity."}</p></div></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] text-[var(--text-tertiary)]"><span className="flex items-center gap-1.5"><Eye size={12} aria-hidden="true" />Observed now</span><span className="text-right">Forecast signal only</span></div>
      </div>
    </section>
  );
}

function HourlyForecastTile({ point }: { point: WeatherHourlyPoint }) {
  const ConditionIcon = conditionIcons[point.condition];
  return (
    <div className="min-w-[76px] snap-start rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] px-2.5 py-3 text-center">
      <p className="text-[10px] font-semibold text-[var(--text-secondary)]">{point.label}</p>
      <ConditionIcon className="mx-auto my-2 size-4 text-[#0875a8]" aria-hidden="true" />
      <p className="kmm-tabular text-sm font-semibold">{point.temperature}°</p>
      <p className="kmm-tabular mt-1 text-[10px] font-semibold text-[#0875a8]">{point.rainProbability}%</p>
      <p className="mt-0.5 text-[9px] text-[var(--text-tertiary)]">rain</p>
    </div>
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
      {location ? <div className={cn("mt-5 rounded-[var(--radius-control-lg)] border p-4", meta.background, level === "HIGH" ? "border-[#f3c3be]" : level === "MEDIUM" ? "border-[#f4d6a5]" : "border-[#c9ead5]")}><div className="flex items-start gap-3"><span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-white/80", meta.text)}>{level === "LOW" ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{location.name}</p><span className={cn("rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-bold uppercase", meta.text)}>{meta.label}</span></div><p className="mt-2 text-sm font-semibold">{level === "HIGH" ? "Field access and crop disease risk" : level === "MEDIUM" ? "Plan around wet field windows" : "Normal operating conditions"}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{level === "HIGH" ? "Persistent rain can delay field movement and increase disease pressure." : level === "MEDIUM" ? "Moderate rain may affect outdoor work and crop-input conversations." : "Current rain volume is below the prototype impact threshold."}</p><p className="mt-3 flex items-start gap-1.5 text-xs font-semibold leading-5"><TriangleAlert size={14} className={cn("mt-0.5 shrink-0", meta.text)} />{level === "HIGH" ? "Confirm route access before time-sensitive visits." : level === "MEDIUM" ? "Keep a route backup and prioritize indoor follow-ups." : "Proceed with planned visits and routine checks."}</p></div></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-black/5 pt-3"><MiniMetric label="Rain / 7d" value={formatWeatherNumber(rainfall7d) + " mm"} /><MiniMetric label="Rain risk" value={location.rainRisk + "%"} /><MiniMetric label="Humidity" value={location.humidity + "%"} /></div></div> : <p className="mt-5 rounded-lg bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">Select a location to see its agriculture signal.</p>}
      <div className="mt-5 grid grid-cols-3 gap-2"><Count label="Low" value={counts.LOW} className="text-[var(--status-success)]" /><Count label="Medium" value={counts.MEDIUM} className="text-[var(--status-warning)]" /><Count label="High" value={counts.HIGH} className="text-[var(--status-danger)]" /></div>
      <p className="mt-4 text-[10px] leading-4 text-[var(--text-tertiary)]">Rule: &gt;150 mm / 7 days or ≥70% rain risk = high; ≥50 mm or ≥45% = medium.</p>
    </section>
  );
}

function Count({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-2.5"><p className="text-[10px] text-[var(--text-tertiary)]">{label}</p><p className={cn("kmm-tabular mt-1 text-xl font-semibold", className)}>{value}</p></div>;
}

function Alerts({ alerts, locations, onSelect }: { alerts: WeatherAlert[]; locations: WeatherLocation[]; onSelect: (id: string) => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="weather-alerts-title">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger)]"><TriangleAlert size={16} /></span><h2 id="weather-alerts-title" className="text-[19px] font-semibold">Weather Alerts</h2></div><span className="kmm-tabular rounded-full bg-[var(--status-danger-bg)] px-2.5 py-1 text-xs font-bold text-[var(--status-danger)]">{alerts.length}</span></div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Conditions that may change field priorities.</p>
      <div className="mt-5 space-y-3">{alerts.map((alert) => <article key={alert.id} className="rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] p-3.5"><div className="flex items-start gap-3"><span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", alert.severity === "HIGH" ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : "bg-[var(--status-warning-bg)] text-[var(--status-warning)]")}><TriangleAlert size={15} /></span><div className="min-w-0"><p className="text-xs font-semibold">{alert.title}</p><p className="mt-1.5 text-xs leading-5 text-[var(--text-secondary)]">{alert.description}</p><div className="mt-3 flex flex-wrap gap-2"><span className="kmm-tabular inline-flex min-h-11 items-center rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{alert.metric}</span>{alert.locationIds.map((id) => locations.find((location) => location.id === id)).filter((location): location is WeatherLocation => Boolean(location)).map((location) => <button key={location.id} type="button" onClick={() => onSelect(location.id)} className="inline-flex min-h-11 items-center rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] hover:text-[var(--brand-600)]">{location.name}</button>)}</div></div></div></article>)}</div>
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
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Practical next steps for the current live forecast signal.</p>
      <div className="mt-5 space-y-2.5">{actions.map((action) => { const Icon = action.icon; return <article key={action.title} className="flex items-start gap-3 rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] p-3.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-600)]"><Icon size={15} /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">{action.title}</p><span className="rounded-full border border-[var(--border-default)] bg-white px-2 py-0.5 text-[9px] font-semibold text-[var(--text-tertiary)]">{action.count}</span></div><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{action.description}</p></div></article>; })}</div>
      <p className="mt-4 text-[10px] leading-4 text-[var(--text-tertiary)]">Phase 1A does not write to Sales, Booking or Team workflows.</p>
    </section>
  );
}
