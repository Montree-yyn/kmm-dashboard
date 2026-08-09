import type { KaiTool, KaiToolContext, KaiToolOutput } from "./types";

export type DateTimeZoneResult = {
  timezone: "Asia/Bangkok" | "Asia/Tokyo" | "Asia/Yangon" | "UTC";
  localDate: string;
  localTime: string;
  iso: string;
  offsetMinutes: number;
};

export type DateTimeToolData = {
  capturedAt: string;
  zones: DateTimeZoneResult[];
  differenceHours: number | null;
};

type SupportedZone = {
  timezone: DateTimeZoneResult["timezone"];
  label: { th: string; en: string; my: string };
  flag: string;
  aliases: RegExp;
};

const SUPPORTED_ZONES: SupportedZone[] = [
  {
    timezone: "Asia/Bangkok",
    label: { th: "ประเทศไทย", en: "Thailand", my: "ထိုင်းနိုင်ငံ" },
    flag: "🇹🇭",
    aliases: /(ประเทศไทย|เวลาไทย|ไทย|bangkok|thailand)/i,
  },
  {
    timezone: "Asia/Tokyo",
    label: { th: "ญี่ปุ่น", en: "Japan", my: "ဂျပန်နိုင်ငံ" },
    flag: "🇯🇵",
    aliases: /(ญี่ปุ่น|โตเกียว|tokyo|japan)/i,
  },
  {
    timezone: "Asia/Yangon",
    label: { th: "เมียนมา", en: "Myanmar", my: "မြန်မာနိုင်ငံ" },
    flag: "🇲🇲",
    aliases: /(เมียนมา|พม่า|ย่างกุ้ง|myanmar|burma|yangon|မြန်မာ|ရန်ကုန်)/i,
  },
  {
    timezone: "UTC",
    label: { th: "UTC", en: "UTC", my: "UTC" },
    flag: "🌐",
    aliases: /\butc\b/i,
  },
];

const DATETIME_INTENT = /(กี่โมง|ตอนนี้.{0,24}เวลา|เวลา.{0,24}ตอนนี้|เวลา(?:ไทย|ญี่ปุ่น|เมียนมา|พม่า)|เวลา.{0,40}ต่างกัน|วันนี้(?:วันที่|วัน)|what time|current time|time is it|time difference|today['’]?s date|what (?:date|day) is it|ယခု.{0,30}(?:အချိန်|နာရီ)|ဒီနေ့.{0,20}(?:ရက်|နေ့))/i;

export const dateTimeTool: KaiTool = {
  id: "datetime",
  matches(message) {
    return DATETIME_INTENT.test(message);
  },
  execute(context) {
    return executeDateTime(context);
  },
};

export function executeDateTime({ message, now }: KaiToolContext): KaiToolOutput {
  const requestedZones = SUPPORTED_ZONES.filter((zone) => zone.aliases.test(message));
  const zones = requestedZones.length ? requestedZones : [SUPPORTED_ZONES[0]];
  const zoneResults = zones.map((zone) => getZoneResult(now, zone.timezone));
  const differenceHours = zoneResults.length === 2
    ? (zoneResults[1].offsetMinutes - zoneResults[0].offsetMinutes) / 60
    : null;
  const data: DateTimeToolData = {
    capturedAt: now.toISOString(),
    zones: zoneResults,
    differenceHours,
  };

  return {
    data,
    answer: composeDateTimeAnswer(message, zones, zoneResults, differenceHours, now),
  };
}

function getZoneResult(
  now: Date,
  timezone: DateTimeZoneResult["timezone"],
): DateTimeZoneResult {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localTime = `${parts.hour}:${parts.minute}:${parts.second}`;
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const sourceAtWholeSecond = Math.floor(now.getTime() / 1_000) * 1_000;
  const offsetMinutes = Math.round((localAsUtc - sourceAtWholeSecond) / 60_000);
  const offset = formatOffset(offsetMinutes);

  return {
    timezone,
    localDate,
    localTime,
    iso: `${localDate}T${localTime}${offset}`,
    offsetMinutes,
  };
}

function composeDateTimeAnswer(
  message: string,
  zones: SupportedZone[],
  results: DateTimeZoneResult[],
  differenceHours: number | null,
  now: Date,
) {
  const language = detectLanguage(message);
  const asksDate = /(วันนี้|วันที่|วันอะไร|today|date|what day|ဒီနေ့|ရက်)/i.test(message);
  const asksTime = /(กี่โมง|เวลา|time|အချိန်|နာရီ)/i.test(message);

  if (asksDate && !asksTime && results.length === 1) {
    const date = new Intl.DateTimeFormat(localeFor(language), {
      timeZone: results[0].timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      calendar: "gregory",
    }).format(now);
    if (language === "th") return `วันนี้ใน${zones[0].label.th}คือ ${date}`;
    if (language === "my") return `ယနေ့ ${zones[0].label.my} တွင် ${date} ဖြစ်သည်။`;
    return `Today in ${zones[0].label.en} is ${date}.`;
  }

  const lines = results.map((result, index) => {
    const label = zones[index].label[language];
    const time = result.localTime.slice(0, 5);
    if (language === "th") return `${zones[index].flag} ${label}: ${time} น.`;
    if (language === "my") return `${zones[index].flag} ${label}: ${time}`;
    return `${zones[index].flag} ${label}: ${time}`;
  });

  if (differenceHours !== null && differenceHours !== 0) {
    const laterIndex = differenceHours > 0 ? 1 : 0;
    const earlierIndex = laterIndex === 1 ? 0 : 1;
    const difference = formatHours(Math.abs(differenceHours), language);
    if (language === "th") {
      lines.push("", `${zones[laterIndex].label.th}เร็วกว่า${zones[earlierIndex].label.th} ${difference}`);
    } else if (language === "my") {
      lines.push("", `${zones[laterIndex].label.my} သည် ${zones[earlierIndex].label.my} ထက် ${difference} စောသည်။`);
    } else {
      lines.push("", `${zones[laterIndex].label.en} is ${difference} ahead of ${zones[earlierIndex].label.en}.`);
    }
  }

  if (language === "th") return ["ตอนนี้", ...lines].join("\n");
  if (language === "my") return ["ယခုအချိန်", ...lines].join("\n");
  return ["Current time", ...lines].join("\n");
}

function detectLanguage(message: string): "th" | "en" | "my" {
  if (/[\u1000-\u109f]/.test(message)) return "my";
  if (/[\u0e00-\u0e7f]/.test(message)) return "th";
  return "en";
}

function localeFor(language: "th" | "en" | "my") {
  if (language === "th") return "th-TH-u-ca-gregory";
  if (language === "my") return "my-MM-u-ca-gregory";
  return "en-GB";
}

function formatOffset(offsetMinutes: number) {
  if (offsetMinutes === 0) return "Z";
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function formatHours(value: number, language: "th" | "en" | "my") {
  const formatted = new Intl.NumberFormat(localeFor(language), {
    maximumFractionDigits: 2,
  }).format(value);
  if (language === "th") return `${formatted} ชั่วโมง`;
  if (language === "my") return `${formatted} နာရီ`;
  return `${formatted} hour${value === 1 ? "" : "s"}`;
}
