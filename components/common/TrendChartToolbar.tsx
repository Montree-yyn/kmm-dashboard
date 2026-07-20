"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type TrendToolbarOption = { id: string; label: string };
export type TrendPeriod = "ytd" | "full-year" | "jan-mar" | "apr-jun" | "jul-sep" | "oct-dec" | "custom";

type TrendChartToolbarProps = {
  metric: string;
  selectedYears: string[];
  period: TrendPeriod;
  onMetricChange: (value: string) => void;
  onYearChange: (values: string[]) => void;
  onPeriodChange: (value: TrendPeriod) => void;
  metricOptions?: TrendToolbarOption[];
  yearOptions?: TrendToolbarOption[];
};

const defaultMetrics = [{ id: "unit", label: "Sales Unit" }, { id: "value", label: "Sales Value" }];
const defaultYears = ["2026", "2025", "2024", "2023", "2022"].map((year) => ({ id: year, label: year }));
const periods: { id: TrendPeriod; label: string }[] = [
  { id: "ytd", label: "YTD" },
  { id: "full-year", label: "Full Year" },
  { id: "jan-mar", label: "Jan-Mar" },
  { id: "apr-jun", label: "Apr-Jun" },
  { id: "jul-sep", label: "Jul-Sep" },
  { id: "oct-dec", label: "Oct-Dec" },
  { id: "custom", label: "Custom" },
];

function yearSummary(years: string[]) {
  if (!years.length) return "Compare Year";
  return years.length <= 2 ? years.join(", ") : `${years.length} Years Selected`;
}

export function TrendChartToolbar({ metric, selectedYears, period, onMetricChange, onYearChange, onPeriodChange, metricOptions = defaultMetrics, yearOptions = defaultYears }: TrendChartToolbarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggleYear = (year: string) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length > 1) onYearChange(selectedYears.filter((value) => value !== year));
      return;
    }
    onYearChange([...selectedYears, year].sort((a, b) => Number(b) - Number(a)));
  };

  return <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-3 whitespace-nowrap sm:w-auto">
    <select aria-label="Metric" value={metric} onChange={(event) => onMetricChange(event.target.value)} className="h-[34px] min-w-[124px] rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151] shadow-[0_1px_2px_rgba(15,23,42,.04)] outline-none transition hover:bg-[#F9FAFB] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/10">
      {metricOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Compare Year" aria-expanded={open} className="flex h-[34px] min-w-[132px] items-center justify-between gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151] shadow-[0_1px_2px_rgba(15,23,42,.04)] transition hover:bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10">
        <span>{yearSummary(selectedYears)}</span><ChevronDown size={16} className={open ? "rotate-180 text-[#6B7280] transition-transform" : "text-[#6B7280] transition-transform"} />
      </button>
      {open && <div className="absolute right-0 top-[42px] z-40 w-44 rounded-[10px] border border-[#E5E7EB] bg-white p-1.5 shadow-[0_16px_36px_rgba(31,41,55,.16)]">
        {yearOptions.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]">
          <input type="checkbox" checked={selectedYears.includes(option.id)} onChange={() => toggleYear(option.id)} className="size-3.5 accent-[#F97316]" />{option.label}
        </label>)}
      </div>}
    </div>
    <select aria-label="Period" value={period} onChange={(event) => onPeriodChange(event.target.value as TrendPeriod)} className="h-[34px] min-w-[112px] rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151] shadow-[0_1px_2px_rgba(15,23,42,.04)] outline-none transition hover:bg-[#F9FAFB] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/10">
      {periods.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>;
}
