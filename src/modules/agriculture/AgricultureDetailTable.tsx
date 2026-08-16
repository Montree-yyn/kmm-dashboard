"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../../lib/utils";
import { agricultureCropName, agriculturePresenceLabel, agricultureRecordTypeLabel, agricultureSeasonLabel, agricultureVerificationLevelLabel } from "./agriculture.ui";
import { formatCropYear, formatNumber } from "./agriculture.data-charts";
import type { DetailRow } from "./agriculture.data-view";
import type { StatisticRecordType } from "./agriculture.types";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["dataView"];
type Language = import("../../../src/locales").Language;

type SortKey = "year" | "area" | "location";

export function AgricultureDetailTable({ rows, copy, language }: { rows: DetailRow[]; copy: Copy; language: Language }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("year");
  const [typeFilter, setTypeFilter] = useState<StatisticRecordType | "">("");
  const [expanded, setExpanded] = useState(false);

  const recordTypes = useMemo(() => [...new Set(rows.map((row) => row.recordType).filter((type): type is StatisticRecordType => type !== null))], [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let result = rows.filter((row) => {
      if (typeFilter && row.recordType !== typeFilter) return false;
      if (!needle) return true;
      return [row.locationName, row.cropName, row.cropCode, row.sourceName ?? ""].some((value) => value.toLowerCase().includes(needle));
    });
    result = [...result].sort((left, right) => {
      if (sort === "area") return (right.area ?? -1) - (left.area ?? -1);
      if (sort === "location") return left.locationName.localeCompare(right.locationName) || left.cropName.localeCompare(right.cropName);
      return (right.cropYear ?? 0) - (left.cropYear ?? 0) || left.locationName.localeCompare(right.locationName);
    });
    return result;
  }, [query, rows, sort, typeFilter]);

  const visible = expanded ? filtered : filtered.slice(0, 5);
  const latestCount = rows.length;

  return (
    <section id="agriculture-detail-table" className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6" data-agri-detail-table>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">{copy.detailTitle}</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.detailSub.replace("{n}", String(latestCount))}</p>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-tertiary)]">{copy.viewAllData.replace("{n}", String(latestCount))}</span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
          <label className="sr-only" htmlFor="agri-detail-search">{copy.searchPlaceholder}</label>
          <input id="agri-detail-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} className="h-10 w-full rounded-lg border border-[var(--border-default)] bg-white pl-9 pr-3 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="agri-detail-type">{copy.filterAllTypes}</label>
          <select id="agri-detail-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as StatisticRecordType | "")} className="h-10 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]">
            <option value="">{copy.filterAllTypes}</option>
            {recordTypes.map((type) => <option key={type} value={type}>{agricultureRecordTypeLabel(type, language)}</option>)}
          </select>
          <label className="sr-only" htmlFor="agri-detail-sort">{copy.sortByYear}</label>
          <select id="agri-detail-sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="h-10 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]">
            <option value="year">{copy.sortByYear}</option>
            <option value="area">{copy.sortByArea}</option>
            <option value="location">{copy.sortByLocation}</option>
          </select>
        </div>
      </div>

      {filtered.length ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="border-b border-[var(--divider)] text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                <tr>
                  <th className="pb-3 pr-3 font-semibold">{copy.colLocation}</th>
                  <th className="pb-3 pr-3 font-semibold">{copy.colCrop}</th>
                  <th className="pb-3 pr-3 font-semibold">{copy.colStatus}</th>
                  <th className="pb-3 pr-3 font-semibold">{copy.colLevel}</th>
                  <th className="pb-3 pr-3 font-semibold">{copy.colYearSeason}</th>
                  <th className="pb-3 pr-3 font-semibold">{copy.colSource}</th>
                  <th className="pb-3 font-semibold">{copy.colVerification}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--divider)]">
                {visible.map((row) => (
                  <tr key={`${row.locationName}-${row.cropCode}-${row.cropYear}`} className="align-top">
                    <td className="py-3 pr-3 font-semibold text-[var(--text-primary)]">{row.locationName}</td>
                    <td className="py-3 pr-3 font-semibold text-[var(--text-primary)]">{agricultureCropName(row.cropName, row.cropCode, language)}</td>
                    <td className="py-3 pr-3"><RecordBadge row={row} copy={copy} language={language} /></td>
                    <td className="py-3 pr-3 text-[var(--text-secondary)]">{row.evidenceGeography ?? "—"}</td>
                    <td className="py-3 pr-3 text-[var(--text-secondary)]">{row.cropYear === null ? "—" : formatCropYear(row.cropYear)}{row.seasonCode ? ` · ${agricultureSeasonLabel(row.seasonCode, language)}` : ""}</td>
                    <td className="max-w-[240px] py-3 pr-3">
                      <span className="block truncate text-[var(--text-secondary)]" title={row.sourceName ?? undefined}>{row.sourceName ?? "—"}</span>
                      {row.area !== null && <span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">{row.areaQualifier === "MORE_THAN" ? ">" : ""}{formatNumber(row.area)}{row.areaUnit ? ` ${row.areaUnit}` : ""}</span>}
                    </td>
                    <td className="py-3 text-[var(--text-secondary)]">{row.confidenceGrade ? agricultureVerificationLevelLabel(row.confidenceGrade, language) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 5 && (
            <button type="button" onClick={() => setExpanded((current) => !current)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#47763d] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              {expanded ? copy.showLess : copy.showMore}
            </button>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-5 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{copy.detailEmpty}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.detailEmptyHelp}</p>
        </div>
      )}
    </section>
  );
}

function RecordBadge({ row, copy, language }: { row: DetailRow; copy: Copy; language: Language }) {
  const presence = row.presenceStatus;
  const record = row.recordType;
  const className = cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
    record === "TARGET" || record === "PLAN"
      ? "border-[#f0d98a] bg-[#fdf6dc] text-[#8a6a00]"
      : presence === "PROBABLE"
        ? "border-[#b3cfe8] bg-[#e9f1f9] text-[#2c5f8a]"
        : "border-[#b8dfb0] bg-[#e8f6e6] text-[#2f6e2a]",
  );
  const label = record === "TARGET" ? copy.badgeTarget : record === "PLAN" ? copy.badgePlan : agriculturePresenceLabel(presence, language);
  return <span className={className}>{label}</span>;
}
