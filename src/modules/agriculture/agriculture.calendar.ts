import type { AgricultureCalendarPrecision, AgricultureCalendarRow, CalendarType } from "./agriculture.types";
import type { Language } from "../../locales";
import { agricultureCalendarPrecisionLabel, agricultureSeasonLabel, agricultureSourceGeographyLabel, agricultureStageLabel } from "./agriculture.ui";

const MONTHS: Record<number, string> = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "May",
  6: "Jun",
  7: "Jul",
  8: "Aug",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dec",
};

const MONTHS_TH: Record<number, string> = {
  1: "ม.ค.",
  2: "ก.พ.",
  3: "มี.ค.",
  4: "เม.ย.",
  5: "พ.ค.",
  6: "มิ.ย.",
  7: "ก.ค.",
  8: "ส.ค.",
  9: "ก.ย.",
  10: "ต.ค.",
  11: "พ.ย.",
  12: "ธ.ค.",
};

const PRECISION_LABELS: Record<AgricultureCalendarPrecision, string> = {
  MONTH: "month",
  EARLY_MONTH: "early month",
  MID_MONTH: "mid-month",
  LATE_MONTH: "late month",
  MONTH_RANGE: "month range",
  SEASON_ONLY: "season only",
};

export function calendarBaselineLabel(row: AgricultureCalendarRow, language: Language = "en") {
  const geography = sourceGeographyLabel(row.sourceGeography, language);
  const season = calendarSeasonLabel(row, language);
  if (language === "th") {
    if (row.calendarType === "HISTORICAL_OBSERVED") return `ข้อมูลย้อนหลังระดับ ${geography} · ${season}`;
    if (row.calendarType === "CURRENT_OBSERVED") return `ข้อมูลปัจจุบันจาก ${geography} · ${season}`;
    if (row.calendarType === "STATE_REGION_BASELINE") return `ข้อมูลอ้างอิงระดับรัฐ/ภูมิภาค · ${season}`;
    if (row.calendarType === "REGIONAL_BASELINE") return `${row.locationName} · ข้อมูลอ้างอิงระดับภูมิภาค · ${season}`;
    return `ข้อมูลอ้างอิงที่ยืนยันแล้วระดับ ${geography} · ${season}`;
  }
  if (row.calendarType === "HISTORICAL_OBSERVED") return `Historical ${geography} Baseline · ${season}`;
  if (row.calendarType === "CURRENT_OBSERVED") return `Current ${geography} Observation · ${season}`;
  if (row.calendarType === "STATE_REGION_BASELINE") return `State/Region Baseline · ${season}`;
  if (row.calendarType === "REGIONAL_BASELINE") return `${row.locationName} Regional Baseline · ${season}`;
  return `Authoritative ${geography} Baseline · ${season}`;
}

export function calendarSeasonLabel(row: AgricultureCalendarRow, language: Language | number = "en") {
  const resolvedLanguage = typeof language === "number" ? "en" : language;
  if (row.cropYear) return `${row.cropYear}/${String((row.cropYear + 1) % 100).padStart(2, "0")}`;
  const season = row.seasonCode ? agricultureSeasonLabel(row.seasonCode, resolvedLanguage) : agricultureSeasonLabel(row.seasonName, resolvedLanguage);
  if (season && season !== (resolvedLanguage === "th" ? "ไม่ระบุฤดูกาล" : "Season N/A")) return row.validFromYear ? `${season} · ${resolvedLanguage === "th" ? "แหล่งข้อมูลปี" : "source"} ${row.validFromYear}` : season;
  return row.validFromYear ? `${resolvedLanguage === "th" ? "ปีของแหล่งข้อมูล" : "Source year"} ${row.validFromYear}` : resolvedLanguage === "th" ? "ไม่ระบุฤดูกาล" : "season unavailable";
}

export function calendarWindowLabel(row: AgricultureCalendarRow, language: Language = "en") {
  const range = formatMonthRange(row, language);
  const stage = stageWindowLabel(row, language);
  if (!range) return language === "th"
    ? row.calendarPrecision === "SEASON_ONLY" ? `${stage}: ระบุเฉพาะฤดูกาล · ไม่ได้เผยแพร่เดือนที่แน่นอน` : `${stage}: ไม่มีข้อมูล`
    : row.calendarPrecision === "SEASON_ONLY" ? `${stage}: Season only · No exact month published` : `${stage}: No Data`;
  const precision = row.calendarPrecision === "MONTH" || row.calendarPrecision === "MONTH_RANGE" ? "" : ` · ${language === "th" ? agricultureCalendarPrecisionLabel(row.calendarPrecision, language) : PRECISION_LABELS[row.calendarPrecision]}`;
  return `${stage}: ${range}${precision}`;
}

export function calendarEstimateLabel(row: AgricultureCalendarRow, language: Language = "en") {
  if (row.estimatedStartDate || row.estimatedEndDate) {
    return `${language === "th" ? "ประมาณการปัจจุบัน" : "Current Estimate"}: ${formatDateRange(row.estimatedStartDate, row.estimatedEndDate, language)}`;
  }
  return language === "th" ? "ประมาณการปัจจุบัน: ไม่มีข้อมูล · รอตรวจสอบ" : "Current estimate: No Data · Needs Verification";
}

export function calendarDurationLabel(row: AgricultureCalendarRow, language: Language = "en") {
  if (row.durationDaysMin === null && row.durationDaysMax === null) return null;
  if (row.durationDaysMin !== null && row.durationDaysMax !== null && row.durationDaysMin !== row.durationDaysMax) {
    return `${language === "th" ? "ระยะเวลา" : "Duration"}: ${row.durationDaysMin}–${row.durationDaysMax} ${language === "th" ? "วัน" : "days"}`;
  }
  return `${language === "th" ? "ระยะเวลา" : "Duration"}: ${row.durationDaysMin ?? row.durationDaysMax} ${language === "th" ? "วัน" : "days"}`;
}

export function calendarResolutionRank(row: Pick<AgricultureCalendarRow, "calendarType" | "sourceGeography" | "inheritedFromLocationId">) {
  const rankByType: Record<CalendarType, number> = {
    AUTHORITATIVE_BASELINE: 1,
    REGIONAL_BASELINE: 2,
    STATE_REGION_BASELINE: 3,
    HISTORICAL_OBSERVED: 5,
    CURRENT_OBSERVED: 6,
  };
  const typeRank = rankByType[row.calendarType] ?? 0;
  const townshipRecord = row.sourceGeography === "TOWNSHIP" && (row.inheritedFromLocationId === undefined || row.inheritedFromLocationId === null);
  return townshipRecord ? Math.max(typeRank, 4) : typeRank;
}

export function bestCalendarRows(rows: AgricultureCalendarRow[]) {
  const selected = new Map<string, AgricultureCalendarRow>();
  for (const row of rows) {
    const key = `${row.locationId}:${row.cropId}:${row.seasonCode ?? row.seasonId ?? ""}:${row.stageCode}`;
    const current = selected.get(key);
    if (!current || calendarResolutionRank(row) > calendarResolutionRank(current)) selected.set(key, row);
  }
  return [...selected.values()].sort((a, b) => {
    const location = a.locationName.localeCompare(b.locationName);
    if (location !== 0) return location;
    const crop = a.cropName.localeCompare(b.cropName);
    if (crop !== 0) return crop;
    return a.stageCode.localeCompare(b.stageCode);
  });
}

export function calendarMonthSpan(row: AgricultureCalendarRow) {
  const start = monthNumber(row.windowStartMonth) ?? monthNumberFromDate(row.baselineStartDate);
  const end = monthNumber(row.windowEndMonth) ?? monthNumberFromDate(row.baselineEndDate) ?? start;
  if (!start || !end) return null;
  return { start, end };
}

export function calendarMonthSegments(row: AgricultureCalendarRow) {
  const span = calendarMonthSpan(row);
  if (!span) return [];
  return span.end >= span.start
    ? [span]
    : [{ start: span.start, end: 12 }, { start: 1, end: span.end }];
}

function sourceGeographyLabel(value: string | null, language: Language) {
  if (language === "th") {
    if (value === "TOWNSHIP") return "Township";
    return agricultureSourceGeographyLabel(value, language);
  }
  if (value === "TOWNSHIP") return "Township";
  if (value === "STATE_REGION") return "State/Region";
  if (value === "REGIONAL") return "Regional";
  if (value === "NATIONAL_REGIONAL") return "National/Regional";
  return "Source";
}

function stageWindowLabel(row: AgricultureCalendarRow, language: Language) {
  if (language === "th") {
    if (row.stageCode === "HARVEST") return "ช่วงเก็บเกี่ยว";
    if (row.stageCode === "TAPPING") return "ช่วงกรีดยาง";
    return `ช่วง${agricultureStageLabel(row.stageCode, language)}`;
  }
  if (row.stageCode === "HARVEST") return "Harvest Window";
  if (row.stageCode === "TAPPING") return "Tapping Window";
  return `${formatStageCode(row.stageCode)} Window`;
}

function formatStageCode(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMonthRange(row: AgricultureCalendarRow, language: Language) {
  const span = calendarMonthSpan(row);
  if (!span) return null;
  const monthNames = language === "th" ? MONTHS_TH : MONTHS;
  const start = monthNames[span.start];
  const end = monthNames[span.end];
  if (!start || !end) return null;
  if (span.start === span.end) return start;
  return `${start}–${end}${span.end < span.start ? language === "th" ? " (ข้ามปี)" : " (cross-year)" : ""}`;
}

function formatDateRange(start: string | null, end: string | null, language: Language) {
  const startValue = start?.trim() || null;
  const endValue = end?.trim() || null;
  if (!startValue && !endValue) return language === "th" ? "ไม่มีข้อมูล" : "No Data";
  if (!endValue || endValue === startValue) return startValue ?? endValue ?? (language === "th" ? "ไม่มีข้อมูล" : "No Data");
  return `${startValue ?? (language === "th" ? "ไม่ระบุ" : "N/A")} → ${endValue}`;
}

function monthNumber(value: number | null | undefined) {
  return value && value >= 1 && value <= 12 ? value : null;
}

function monthNumberFromDate(value: string | null) {
  const month = value?.match(/^\d{4}-(\d{2})/)?.[1];
  return month ? monthNumber(Number(month)) : null;
}
