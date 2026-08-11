export const DEFAULT_DAILY_TIME_ZONE = "Asia/Yangon";

export function normalizeDailyTimeZone(value: string | null | undefined) {
  return value === "Asia/Bangkok" || value === "UTC" || value === "Asia/Yangon"
    ? value
    : DEFAULT_DAILY_TIME_ZONE;
}

export function dateInTimeZone(date: Date, timeZone = DEFAULT_DAILY_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function calendarMonth(date: string) {
  const start = `${date.slice(0, 7)}-01`;
  const monthEnd = new Date(`${start}T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  return { start, end: monthEnd.toISOString().slice(0, 10) };
}
