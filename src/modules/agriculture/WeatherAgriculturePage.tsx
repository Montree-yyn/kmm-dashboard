"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, CloudRain, Leaf, RefreshCw, ShieldAlert, Sprout } from "lucide-react";
import { useCompany } from "../../../src/hooks/useCompany";
import { useLocale } from "../../../src/hooks/useLocale";
import { cn } from "../../../lib/utils";
import { loadAgricultureOverview } from "./agriculture.client";
import { AgricultureCalendar } from "./AgricultureCalendar";
import { AgricultureDataPage } from "./AgricultureDataPage";
import { AgricultureFieldVerification } from "./AgricultureFieldVerification";
import { AgricultureOverview } from "./AgricultureOverview";
import { bestCalendarRows } from "./agriculture.calendar";
import { agricultureCopy, agricultureCropName, agricultureDataStatusLabel, agricultureSeasonLabel } from "./agriculture.ui";
import {
  calculateAgricultureCalendarCoverage,
  calculateAgricultureCoverage,
  calculateAgricultureVerificationCoverage,
  confidenceFromPresenceRecords,
  countEligibleLocalCrops,
  isEligibleActualStatistic,
  isEligibleLocalCropPresence,
  isEligibleStateRegionStatistic,
  type AgricultureGeographyScope,
  type AgricultureOverviewPayload,
  type AgricultureTrendMetric,
} from "./agriculture.types";

type WeatherAgricultureTab = "overview" | "weather" | "agriculture" | "calendar";

const tabs: Array<{ value: WeatherAgricultureTab; icon: typeof CloudRain }> = [
  { value: "overview", icon: Sprout },
  { value: "weather", icon: CloudRain },
  { value: "agriculture", icon: Leaf },
  { value: "calendar", icon: CalendarDays },
];

function tabLabel(value: WeatherAgricultureTab, language: import("../../../src/locales").Language) {
  const copy = agricultureCopy(language);
  return copy.tabs[value];
}

export function WeatherAgriculturePage({ weatherPage }: { weatherPage: ReactNode }) {
  const { selectedCompany } = useCompany();
  const selectedCompanyId = selectedCompany?.id;
  const { t, language } = useLocale();
  const copy = agricultureCopy(language);
  const [activeTab, setActiveTab] = useState<WeatherAgricultureTab>("overview");
  const [overview, setOverview] = useState<AgricultureOverviewPayload | null>(null);
  const [selectedGeography, setSelectedGeography] = useState<AgricultureGeographyScope>("TOWNSHIP");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedCropId, setSelectedCropId] = useState("");
  const [selectedYearFrom, setSelectedYearFrom] = useState("");
  const [selectedYearTo, setSelectedYearTo] = useState("");
  const [selectedTrendMetric, setSelectedTrendMetric] = useState<AgricultureTrendMetric>("SOWN_AREA");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    setError("");
    try {
      const payload = await loadAgricultureOverview(selectedCompanyId);
      setOverview(payload);
      setSelectedLocationId((current) => payload.locations.some((location) => location.locationId === current) ? current : "");
      setSelectedCropId((current) => payload.crops.some((crop) => crop.cropId === current) ? current : "");
    } catch (loadError) {
      setError(language === "th" ? "ไม่สามารถโหลดข้อมูลสภาพอากาศและเกษตรกรรมได้" : loadError instanceof Error ? loadError.message : "Unable to load Weather & Agriculture data.");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [language, selectedCompanyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredOverview = useMemo(() => {
    if (!overview) return null;
    const scopedLocations = overview.locations.filter((location) => selectedGeography === "ALL" || location.geographyLevel === selectedGeography);
    const scopeLocationIds = new Set(scopedLocations.map((location) => location.locationId));
    const locationIds = selectedLocationId && scopeLocationIds.has(selectedLocationId) ? new Set([selectedLocationId]) : scopeLocationIds;
    const cropIds = selectedCropId ? new Set([selectedCropId]) : null;
    const cropPresence = overview.cropPresence.filter((row) => locationIds.has(row.locationId) && (!cropIds || cropIds.has(row.cropId)));
    const fromYear = selectedYearFrom ? Number(selectedYearFrom) : null;
    const toYear = selectedYearTo ? Number(selectedYearTo) : null;
    const statistics = overview.statistics.filter((row) => locationIds.has(row.locationId) && (!cropIds || cropIds.has(row.cropId)) && (fromYear === null || row.cropYear === null || row.cropYear >= fromYear) && (toYear === null || row.cropYear === null || row.cropYear <= toYear));
    const eligiblePresenceKeys = new Set(cropPresence.filter(isEligibleLocalCropPresence).map((row) => `${row.locationId}:${row.cropId}`));
    const actualStatistics = statistics.filter((row) => isEligibleActualStatistic(row) && eligiblePresenceKeys.has(`${row.locationId}:${row.cropId}`));
    const cultivatedAreaRows = actualStatistics.filter((row) => row.cultivatedArea !== null);
    const stateStatistics = statistics.filter(isEligibleStateRegionStatistic);
    const latestStateYear = stateStatistics.reduce<number | null>((latest, row) => row.cropYear !== null && (latest === null || row.cropYear > latest) ? row.cropYear : latest, null);
    const latestStateStatistics = latestStateYear === null ? [] : stateStatistics.filter((row) => row.cropYear === latestStateYear);
    const stateSownRows = latestStateStatistics.filter((row) => row.sownArea !== null);
    const stateHarvestedRows = latestStateStatistics.filter((row) => row.harvestedArea !== null);
    const stateProductionRows = latestStateStatistics.filter((row) => row.production !== null);
    const productionRows = actualStatistics.filter((row) => row.production !== null);
    const calendarRows = overview.calendar.filter((row) => locationIds.has(row.locationId) && (!cropIds || cropIds.has(row.cropId)));
    const scopedDataGaps = overview.dataGaps.filter((row) => locationIds.has(row.locationId));
    const fieldVerifications = overview.fieldVerifications.filter((row) => locationIds.has(row.locationId) && (!cropIds || cropIds.has(row.cropId ?? "")));
    const officialUnionYield = overview.officialUnionYield.filter((row) => (!cropIds || cropIds.has(row.cropId)) && (fromYear === null || row.cropYear >= fromYear) && (toYear === null || row.cropYear <= toYear));
    const harvestRows = bestCalendarRows(calendarRows.filter((row) => row.stageCode === "HARVEST"));
    const stateScope = selectedGeography === "STATE_REGION";
    return {
      ...overview,
      kpis: {
        ...overview.kpis,
        activeCrops: stateScope ? distinctCount(latestStateStatistics.map((row) => row.cropId)) : countEligibleLocalCrops(cropPresence) || null,
        cultivatedArea: stateScope ? null : sumNumbers(cultivatedAreaRows.map((row) => row.cultivatedArea)),
        cultivatedAreaUnit: stateScope ? null : cultivatedAreaRows[0]?.areaUnit ?? null,
        cultivatedAreaQualifier: stateScope ? null : cultivatedAreaRows.some((row) => row.valueQualifier === "MORE_THAN") ? "MORE_THAN" : cultivatedAreaRows[0]?.valueQualifier ?? null,
        sownArea: stateScope ? sumNumbers(stateSownRows.map((row) => row.sownArea)) : null,
        sownAreaUnit: stateScope ? stateSownRows[0]?.sownAreaUnit ?? null : null,
        harvestedArea: stateScope ? sumNumbers(stateHarvestedRows.map((row) => row.harvestedArea)) : null,
        harvestedAreaUnit: stateScope ? stateHarvestedRows[0]?.harvestedAreaUnit ?? null : null,
        production: stateScope ? sumNumbers(stateProductionRows.map((row) => row.production)) : sumNumbers(productionRows.map((row) => row.production)),
        productionUnit: (stateScope ? stateProductionRows[0]?.productionUnit : productionRows[0]?.productionUnit) ?? null,
        harvestSeason: stateScope ? null : harvestRows.length ? harvestRows.map((row) => row.cropYear ? `${row.cropYear}/${String((row.cropYear + 1) % 100).padStart(2, "0")}` : agricultureSeasonLabel(row.seasonCode ?? row.seasonName, language)).join(", ") : null,
        dataConfidence: stateScope ? averageConfidence(stateStatistics.map((row) => row.confidenceScore)) : confidenceFromPresenceRecords(cropPresence),
      },
      locations: scopedLocations.filter((row) => locationIds.has(row.locationId)),
      cropPresence,
      statistics,
      varieties: overview.varieties.filter((row) => locationIds.has(row.locationId) && (!cropIds || cropIds.has(row.cropId))),
      historicalHazards: overview.historicalHazards.filter((row) => locationIds.has(row.locationId)),
      contexts: overview.contexts.filter((row) => locationIds.has(row.locationId)),
      dataGaps: scopedDataGaps,
      calendar: calendarRows,
      officialUnionYield,
      weatherState: overview.weatherState.filter((row) => locationIds.has(row.locationId) && (!cropIds || cropIds.has(row.cropId))),
      opportunities: overview.opportunities.filter((row) => (!row.locationId || locationIds.has(row.locationId)) && (!cropIds || row.cropId === selectedCropId)),
      coverage: calculateAgricultureCoverage(
        scopedLocations.filter((row) => locationIds.has(row.locationId)),
        cropPresence,
        statistics,
        calendarRows,
      ),
      stateRegionCoverage: overview.stateRegionCoverage.filter((row) => locationIds.has(row.locationId)),
      calendarCoverage: calculateAgricultureCalendarCoverage(
        scopedLocations.filter((row) => locationIds.has(row.locationId)),
        overview.crops.filter((row) => !cropIds || cropIds.has(row.cropId)),
        calendarRows,
      ),
      fieldVerifications,
      verificationCoverage: calculateAgricultureVerificationCoverage(
        scopedLocations.filter((row) => locationIds.has(row.locationId)),
        fieldVerifications,
        scopedDataGaps,
      ),
      geographyScope: selectedGeography,
    };
  }, [language, overview, selectedCropId, selectedGeography, selectedLocationId, selectedYearFrom, selectedYearTo]);

  const selectedWeatherLocationId = selectedLocationId
    ? selectedGeography === "STATE_REGION" ? "" : filteredOverview?.locations.find((row) => row.locationId === selectedLocationId)?.weatherLocationId ?? ""
    : selectedGeography === "STATE_REGION" ? "" : filteredOverview?.weather.locations[0]?.id ?? "";

  function selectWeatherLocation(weatherLocationId: string) {
    const match = overview?.locations.find((row) => row.weatherLocationId === weatherLocationId);
    if (match && (selectedGeography === "ALL" || match.geographyLevel === selectedGeography)) setSelectedLocationId(match.locationId);
  }

  return (
    <main className="min-h-[calc(100vh-72px)] w-full min-w-0 max-w-full overflow-x-clip bg-[var(--surface-canvas)] text-[var(--text-primary)]" data-weather-agriculture-page>
      <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-5 xl:p-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0"><div className="mb-2 h-1 w-9 rounded-full bg-[var(--brand-500)]" aria-hidden="true" /><h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[32px]">{t("route.weather.title")}</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">{t("route.weather.subtitle")}</p></div>
          <div className="flex flex-wrap items-center gap-2 text-xs"><span className={cn("inline-flex items-center gap-2 rounded-lg border bg-[var(--surface-default)] px-3 py-2.5", overview?.weather.availability === "LIVE" || overview?.weather.availability === "CACHED" ? "border-[var(--status-success-bg)]" : "border-[var(--border-default)]")}><span className={cn("size-2 rounded-full", overview?.weather.availability === "LIVE" ? "bg-[var(--status-success)]" : overview?.weather.availability === "CACHED" ? "bg-[var(--status-warning)]" : "bg-[var(--text-tertiary)]")} />{overview?.weather.fetchedAt ? `${copy.top.weatherUpdated} ${formatTime(overview.weather.fetchedAt)}` : copy.top.weatherUnavailable}</span><span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2.5 text-[var(--text-secondary)]"><ShieldAlert size={15} />{copy.top.agriculture}: {agricultureDataStatusLabel(overview?.dataStatus, language)}</span><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-wait disabled:opacity-60"><RefreshCw size={14} className={cn(loading && "animate-spin motion-reduce:animate-none")} />{loading ? copy.common.refreshing : copy.common.refresh}</button></div>
        </header>

        <nav className="mt-5 overflow-x-auto border-b border-[var(--border-default)]" aria-label={copy.top.sectionsAria} role="tablist">
          <div className="flex min-w-max gap-1">{tabs.map((tab) => { const Icon = tab.icon; const active = activeTab === tab.value; return <button key={tab.value} type="button" role="tab" aria-selected={active} onClick={() => setActiveTab(tab.value)} className={cn("relative inline-flex min-h-12 items-center gap-2 px-4 text-sm font-semibold text-[var(--text-secondary)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", active && "text-[var(--brand-600)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--brand-500)]") }><Icon size={16} aria-hidden="true" />{tabLabel(tab.value, language)}</button>; })}</div>
        </nav>

        {activeTab !== "weather" && <AgricultureFilterBar overview={overview} selectedGeography={selectedGeography} selectedLocationId={selectedLocationId} selectedCropId={selectedCropId} selectedYearFrom={selectedYearFrom} selectedYearTo={selectedYearTo} selectedTrendMetric={selectedTrendMetric} onGeographyChange={(value) => { setSelectedGeography(value); setSelectedLocationId(""); }} onLocationChange={setSelectedLocationId} onCropChange={setSelectedCropId} onYearFromChange={setSelectedYearFrom} onYearToChange={setSelectedYearTo} onTrendMetricChange={setSelectedTrendMetric} />}

        {activeTab === "weather" ? <div className="mt-5">{weatherPage}</div> : loading && !overview ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : filteredOverview ? <div className="mt-5">{activeTab === "overview" && <AgricultureOverview overview={filteredOverview} selectedLocationId={selectedLocationId} selectedWeatherLocationId={selectedWeatherLocationId} onWeatherLocationSelect={selectWeatherLocation} />}{activeTab === "agriculture" && <><AgricultureDataPage overview={filteredOverview} onViewGaps={() => document.querySelector("[data-local-field-verification]")?.scrollIntoView({ behavior: "smooth", block: "start" })} /><AgricultureFieldVerification overview={overview ?? filteredOverview} selectedLocationId={selectedLocationId} selectedCropId={selectedCropId} onSaved={() => void load()} /></>}{activeTab === "calendar" && <AgricultureCalendar overview={filteredOverview} onOpenAgricultureData={() => setActiveTab("agriculture")} onResetFilters={() => { setSelectedGeography("TOWNSHIP"); setSelectedLocationId(""); setSelectedCropId(""); setSelectedYearFrom(""); setSelectedYearTo(""); }} />}</div> : null}
      </div>
    </main>
  );
}

function AgricultureFilterBar({ overview, selectedGeography, selectedLocationId, selectedCropId, selectedYearFrom, selectedYearTo, selectedTrendMetric, onGeographyChange, onLocationChange, onCropChange, onYearFromChange, onYearToChange, onTrendMetricChange }: { overview: AgricultureOverviewPayload | null; selectedGeography: AgricultureGeographyScope; selectedLocationId: string; selectedCropId: string; selectedYearFrom: string; selectedYearTo: string; selectedTrendMetric: AgricultureTrendMetric; onGeographyChange: (value: AgricultureGeographyScope) => void; onLocationChange: (value: string) => void; onCropChange: (value: string) => void; onYearFromChange: (value: string) => void; onYearToChange: (value: string) => void; onTrendMetricChange: (value: AgricultureTrendMetric) => void }) {
  const { language } = useLocale();
  const copy = agricultureCopy(language);
  const locations = overview?.locations.filter((location) => selectedGeography === "ALL" || location.geographyLevel === selectedGeography) ?? [];
  const years = [...new Set((overview?.statistics ?? []).filter(isEligibleStateRegionStatistic).map((row) => row.cropYear).filter((year): year is number => year !== null))].sort((a, b) => a - b);
  return <section className="mt-5 flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-label={copy.filters.aria}><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-600)]"><Sprout size={17} /></span><div><p className="text-sm font-semibold">{copy.filters.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.filters.description}</p></div></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="agri-geography-filter">{copy.filters.geography}</label><select id="agri-geography-filter" value={selectedGeography} onChange={(event) => onGeographyChange(event.target.value as AgricultureGeographyScope)} className="min-h-11 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"><option value="ALL">{copy.filters.allGeographies}</option><option value="STATE_REGION">{copy.filters.stateRegion}</option><option value="REGIONAL">{copy.filters.regional}</option><option value="TOWNSHIP">{copy.filters.township}</option></select><label className="sr-only" htmlFor="agri-location-filter">{copy.filters.location}</label><select id="agri-location-filter" value={selectedLocationId} onChange={(event) => onLocationChange(event.target.value)} className="min-h-11 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"><option value="">{copy.filters.allLocations}</option>{locations.map((location) => <option key={location.locationId} value={location.locationId}>{location.canonicalName}</option>)}</select><label className="sr-only" htmlFor="agri-crop-filter">{copy.filters.crop}</label><select id="agri-crop-filter" value={selectedCropId} onChange={(event) => onCropChange(event.target.value)} className="min-h-11 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"><option value="">{copy.filters.allCrops}</option>{overview?.crops.map((crop) => <option key={crop.cropId} value={crop.cropId}>{agricultureCropName(crop.cropName, crop.cropCode, language)}</option>)}</select><label className="sr-only" htmlFor="agri-year-from-filter">{copy.filters.yearFrom}</label><select id="agri-year-from-filter" value={selectedYearFrom} onChange={(event) => onYearFromChange(event.target.value)} className="min-h-11 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)]"><option value="">{copy.filters.allYearsFrom}</option>{years.map((year) => <option key={year} value={year}>{formatCropYear(year)}</option>)}</select><label className="sr-only" htmlFor="agri-year-to-filter">{copy.filters.yearTo}</label><select id="agri-year-to-filter" value={selectedYearTo} onChange={(event) => onYearToChange(event.target.value)} className="min-h-11 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)]"><option value="">{copy.filters.allYearsTo}</option>{years.map((year) => <option key={year} value={year}>{formatCropYear(year)}</option>)}</select><label className="sr-only" htmlFor="agri-trend-metric-filter">{copy.filters.historicalTrendMetric}</label><select id="agri-trend-metric-filter" value={selectedTrendMetric} onChange={(event) => onTrendMetricChange(event.target.value as AgricultureTrendMetric)} className="min-h-11 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)]"><option value="SOWN_AREA">{copy.filters.sownAreaTrend}</option><option value="HARVESTED_AREA">{copy.filters.harvestedAreaTrend}</option><option value="PRODUCTION">{copy.filters.productionTrend}</option></select></div></section>;
}

function LoadingState() {
  const { language } = useLocale();
  const copy = agricultureCopy(language);
  return <section className="mt-5 grid min-h-[360px] place-items-center rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-6 text-center shadow-[var(--shadow-card)]" role="status" aria-live="polite"><div><div className="mx-auto size-9 animate-spin rounded-full border-4 border-[var(--brand-100)] border-t-[var(--brand-600)] motion-reduce:animate-none" /><p className="mt-4 text-sm font-semibold">{copy.top.loadingData}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.top.loadingDataHelp}</p></div></section>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { language } = useLocale();
  const copy = agricultureCopy(language);
  return <section className="mt-5 rounded-[var(--radius-card)] border border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)] p-5" role="alert"><p className="text-sm font-semibold text-[var(--status-danger)]">{copy.top.weatherAgricultureUnavailable}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{message}</p><button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--status-danger)] bg-white px-3 text-xs font-semibold text-[var(--status-danger)]"><RefreshCw size={14} />{copy.common.tryAgain}</button></section>;
}

function formatTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "unknown";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(timestamp));
}

function sumNumbers(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
}

function distinctCount(values: string[]) {
  const count = new Set(values).size;
  return count || null;
}

function averageConfidence(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return present.length ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length) : null;
}

function formatCropYear(year: number) {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}
