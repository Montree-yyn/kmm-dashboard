import type { Language } from "../../locales";
import type { WeatherAlert, WeatherCondition, WeatherCountry, WeatherLocation, WeatherRiskLevel } from "./weather.types";
import { localizedText } from "../agriculture/agriculture.ui";

export { localizedText };

export type WeatherMapLayerValue = "radar" | "cloud" | "rain" | "wind" | "temperature";

export function weatherCopy(language: Language) {
  const text = (thai: string, english: string) => localizedText(language, thai, english);
  return {
    statusStale: text("ข้อมูลเก่า", "Stale"),
    statusLive: text("ข้อมูลสด", "Live"),
    statusConnecting: text("กำลังเชื่อมต่อ", "Connecting"),
    planningSignals: text("สัญญาณประกอบการวางแผนเกษตรและงานขายในพื้นที่", "agriculture and field-sales planning signals"),
    loading: text("กำลังโหลด", "Loading"),
    refreshLiveWeather: text("โหลดข้อมูลสภาพอากาศสดใหม่", "Refresh live weather"),
    refreshing: text("กำลังโหลดข้อมูลใหม่…", "Refreshing…"),
    refreshAria: text("โหลดข้อมูลสภาพอากาศสดใหม่", "Refresh live weather snapshot"),
    scopeAria: text("ขอบเขตข้อมูลสภาพอากาศ", "Weather scope"),
    coverageScope: text("ขอบเขตพื้นที่", "Coverage scope"),
    scopeDescription: text("กรองสัญญาณสภาพอากาศทั้งหมดตามพื้นที่รับผิดชอบ", "Filter all Weather Intelligence signals by operating area."),
    locationScopeAria: text("ขอบเขตพื้นที่สภาพอากาศ", "Weather location scope"),
    liveUnavailable: text("ไม่พบข้อมูลสภาพอากาศสด", "Live weather is unavailable"),
    tryAgain: text("ลองอีกครั้ง", "Try again"),
    radarForecastAria: text("เรดาร์สภาพอากาศสดและพยากรณ์ของพื้นที่ที่เลือก", "Live weather radar and selected location forecast"),
    weatherActionsAria: text("การดำเนินงานด้านสภาพอากาศ", "Weather actions"),
    loadingLive: text("กำลังโหลดสภาพอากาศสด", "Loading live weather"),
    loadingForecast: text("กำลังขอข้อมูลสภาพอากาศปัจจุบันและพยากรณ์ 7 วันสำหรับพื้นที่ปฏิบัติงาน", "Requesting current conditions and a seven-day forecast for operating areas."),
    noLiveSnapshot: text("ยังไม่มีข้อมูลสภาพอากาศสด", "No live weather snapshot"),
    noLiveSnapshotHelp: text("แดชบอร์ดยังไม่ได้รับข้อมูลสภาพอากาศปัจจุบัน ลองอีกครั้งเมื่อผู้ให้บริการสภาพอากาศพร้อมใช้งาน", "The dashboard has not received live conditions yet. Try again when the weather provider is reachable."),
    currentConditions: text("สภาพอากาศปัจจุบัน", "Current conditions"),
    selectedArea: text("พื้นที่ที่เลือก", "Selected area"),
    overviewHelp: text("ภาพรวมสภาพอากาศ · เลือกพื้นที่ปฏิบัติงานด้านล่างเพื่อดูรายละเอียด", "Weather overview · choose an operating area below to update the detail view."),
    now: text("ขณะนี้", "Now"),
    noBranchMapping: text("ยังไม่มีการเชื่อมโยงสาขา", "No branch mapping"),
    rainRisk: text("โอกาสฝน", "Rain risk"),
    rainRiskPercent: text("โอกาสฝน", "rain risk"),
    avgRain24h: text("ฝนเฉลี่ย 24 ชั่วโมง", "Avg rain 24h"),
    avgTemperature: text("อุณหภูมิเฉลี่ย", "Avg temperature"),
    rainAtArea: text("ฝนในพื้นที่", "Rain at area"),
    highRiskAreas: text("พื้นที่เสี่ยงสูง", "High-risk areas"),
    rainfall24h: text("ปริมาณฝน · 24 ชั่วโมง", "Rainfall · 24h"),
    humidity: text("ความชื้น", "Humidity"),
    wind: text("ลม", "Wind"),
    todayHighLow: text("สูงสุด / ต่ำสุดวันนี้", "Today high / low"),
    operatingAreas: text("พื้นที่ปฏิบัติงาน", "Operating areas"),
    locationSelectHelp: text("เลือกพื้นที่เพื่อเน้นหมุดบนเรดาร์และดูข้อมูล 12 ชั่วโมงถัดไป", "Select a location to focus the radar pin and next 12 hours."),
    monitored: text("พื้นที่ติดตาม", "monitored"),
    weatherLocations: text("พื้นที่สภาพอากาศ", "Weather locations"),
    selectLocationDetail: text("เลือกพื้นที่เพื่อดูรายละเอียดรายชั่วโมง", "Select a location to see hourly detail."),
    selectedLocation: text("พื้นที่ที่เลือก", "Selected location"),
    currentCondition: text("สภาพอากาศปัจจุบัน", "Current condition"),
    next12Hours: text("12 ชั่วโมงถัดไป", "Next 12 hours"),
    hourlyHelp: text("โอกาสฝนและอุณหภูมิรายชั่วโมง", "Rain probability and temperature by hour."),
    hourlyUnavailable: text("ไม่มีรายละเอียดรายชั่วโมงในข้อมูลชุดนี้", "Hourly detail is not available in this snapshot."),
    fieldAccessSignal: text("สัญญาณการเข้าพื้นที่", "Field access signal"),
    fieldAccessHigh: text("ฝนที่พบและพยากรณ์บ่งชี้ว่าควรยืนยันเส้นทางก่อนลงพื้นที่ที่มีเวลาจำกัด", "Observed rain and the forecast suggest confirming route access before outdoor visits."),
    fieldAccessMedium: text("ควรเตรียมเส้นทางสำรองและเลือกช่วงฝนน้อยสำหรับงานกลางแจ้ง", "Keep a backup route and use lower-rain windows for outdoor work."),
    fieldAccessLow: text("ยังไม่พบข้อจำกัดจากสภาพอากาศที่สำคัญสำหรับงานภาคสนามตามปกติ", "No major weather constraint is indicated for routine field activity."),
    observedNow: text("ข้อมูลที่สังเกตได้ขณะนี้", "Observed now"),
    forecastSignalOnly: text("เป็นสัญญาณจากพยากรณ์เท่านั้น", "Forecast signal only"),
    sevenDayForecast: text("พยากรณ์ 7 วัน", "7-Day Forecast"),
    forecastHelp: text("โอกาสฝน ปริมาณฝน และอุณหภูมิแยกตามพื้นที่", "Rain probability, volume and temperature by location."),
    forecastCaption: text("พยากรณ์สภาพอากาศ 7 วัน", "Seven-day weather forecast."),
    location: text("พื้นที่", "Location"),
    agricultureImpact: text("ผลกระทบต่อการเกษตร", "Agriculture Impact"),
    ruleBasedSignal: text("สัญญาณการทำงานตามกฎสำหรับพื้นที่ที่เลือก", "Rule-based operating signal for the selected location."),
    highImpactTitle: text("ความเสี่ยงต่อการเข้าพื้นที่และโรคพืช", "Field access and crop disease risk"),
    mediumImpactTitle: text("วางแผนตามช่วงที่พื้นที่เปียก", "Plan around wet field windows"),
    lowImpactTitle: text("สภาพการทำงานปกติ", "Normal operating conditions"),
    highImpactHelp: text("ฝนต่อเนื่องอาจทำให้การเดินทางลงพื้นที่ล่าช้าและเพิ่มแรงกดดันจากโรคพืช", "Persistent rain can delay field movement and increase disease pressure."),
    mediumImpactHelp: text("ฝนปานกลางอาจกระทบงานกลางแจ้งและการพูดคุยเรื่องปัจจัยการผลิต", "Moderate rain may affect outdoor work and crop-input conversations."),
    lowImpactHelp: text("ปริมาณฝนปัจจุบันต่ำกว่าเกณฑ์ผลกระทบของต้นแบบ", "Current rain volume is below the prototype impact threshold."),
    highImpactAction: text("ยืนยันเส้นทางก่อนเข้าพื้นที่ที่มีเวลาจำกัด", "Confirm route access before time-sensitive visits."),
    mediumImpactAction: text("เตรียมเส้นทางสำรองและเน้นติดตามงานในอาคาร", "Keep a route backup and prioritize indoor follow-ups."),
    lowImpactAction: text("ดำเนินการตามแผนและตรวจติดตามตามปกติ", "Proceed with planned visits and routine checks."),
    selectLocationAgriculture: text("เลือกพื้นที่เพื่อดูสัญญาณด้านเกษตร", "Select a location to see its agriculture signal."),
    low: text("ปกติ", "Low"),
    medium: text("เฝ้าระวัง", "Medium"),
    high: text("สูง", "High"),
    highRiskAreasCount: text("พื้นที่เสี่ยงสูง", "high-risk areas"),
    wetRouteAreasCount: text("พื้นที่ที่เส้นทางเปียก", "wet-route areas"),
    planningOnly: text("ใช้ประกอบการวางแผนเท่านั้น", "Planning only"),
    ruleHelp: text("เกิน 150 มม. / 7 วัน หรือโอกาสฝน ≥70% = สูง; ตั้งแต่ 50 มม. หรือ ≥45% = เฝ้าระวัง", ">150 mm / 7 days or ≥70% rain risk = high; ≥50 mm or ≥45% = medium."),
    alerts: text("การแจ้งเตือนสภาพอากาศ", "Weather Alerts"),
    alertsHelp: text("เงื่อนไขที่อาจทำให้ต้องเปลี่ยนลำดับความสำคัญของงานภาคสนาม", "Conditions that may change field priorities."),
    noAlerts: text("ไม่มีการแจ้งเตือนในขอบเขตนี้", "No alerts in this scope."),
    recommendedActions: text("การดำเนินการที่แนะนำ", "Recommended Actions"),
    recommendedHelp: text("ขั้นตอนปฏิบัติสำหรับสัญญาณพยากรณ์สดปัจจุบัน", "Practical next steps for the current live forecast signal."),
    routeChecks: text("ให้ความสำคัญกับการตรวจเส้นทาง", "Prioritize route checks"),
    routeChecksHelp: text("ยืนยันสภาพถนนและการเข้าพื้นที่ก่อนการลงพื้นที่ที่มีความเสี่ยงสูง", "Confirm road and field access before high-risk visits."),
    outdoorActivity: text("จัดลำดับงานกลางแจ้งใหม่", "Re-sequence outdoor activity"),
    outdoorActivityHelp: text("เลือกช่วงฝนน้อยกว่าสำหรับการสาธิตและเยี่ยมแปลง", "Use lower-rain windows for demos and crop visits."),
    weatherExceptions: text("บันทึกข้อยกเว้นจากสภาพอากาศ", "Log weather exceptions"),
    weatherExceptionsHelp: text("บันทึกการเปลี่ยนแปลงจากสภาพอากาศในแผนงานขายประจำวัน", "Capture weather-driven changes in the daily sales plan."),
    phaseNote: text("ระยะที่ 1A ยังไม่เขียนข้อมูลไปยัง workflow Sales, Booking หรือ Team", "Phase 1A does not write to Sales, Booking or Team workflows."),
    forecastSource: text("พยากรณ์", "Forecast"),
    radarSource: text("เรดาร์", "radar"),
    updated: text("อัปเดต", "updated"),
    planningAid: text("ใช้ประกอบการวางแผนเท่านั้น ไม่ใช่คำแนะนำด้านเกษตรหรือความปลอดภัย", "Planning aid only; not agronomic or safety advice."),
    liveRadar: text("เรดาร์สภาพอากาศสด", "Live Weather Radar"),
    radarDescription: text("ปริมาณฝนที่สังเกตได้ในเมียนมาและ 5 เขตของ Tak", "Observed precipitation over Myanmar and the five Tak districts."),
    exitFullscreen: text("ออกจากแผนที่สภาพอากาศแบบเต็มหน้าจอ", "Exit weather map fullscreen"),
    openFullscreen: text("เปิดแผนที่สภาพอากาศแบบเต็มหน้าจอ", "Open weather map fullscreen"),
    exitFullscreenShort: text("ออกจากเต็มหน้าจอ", "Exit fullscreen"),
    fullscreen: text("เต็มหน้าจอ", "Fullscreen"),
    radarAvailable: text("เรดาร์พร้อมใช้งาน", "Radar available"),
    radarUnavailable: text("เรดาร์ไม่พร้อมใช้งาน", "Radar unavailable"),
    interactiveMap: text("แผนที่สภาพอากาศแบบโต้ตอบของเมียนมาและ Tak ประเทศไทย", "Interactive weather map of Myanmar and Tak, Thailand"),
    loadingMap: text("กำลังโหลดแผนที่แบบโต้ตอบ…", "Loading interactive map…"),
    mapInstructions: text("ลาก · ใช้นิ้วสองนิ้วหรือเลื่อนเพื่อซูม · แตะหมุดเพื่อเน้นพื้นที่ · เรดาร์แสดงฝนที่สังเกตได้", "Drag · pinch or scroll to zoom · tap a pin to focus the area · radar shows observed rain"),
    mapControls: text("การควบคุมแผนที่", "Map controls"),
    resetOverview: text("กลับไปดูภาพรวมเมียนมา", "Reset map to Myanmar overview"),
    weatherLayers: text("ชั้นข้อมูลสภาพอากาศ", "Weather layers"),
    radarPinMetric: text("เรดาร์และตัวชี้วัดหมุดสภาพอากาศ", "Weather radar and pin metric"),
    radarTimeline: text("ลำดับเวลาเรดาร์ · ย้อนหลัง 2 ชั่วโมง", "Radar timeline · past 2 hours"),
    radarTimelineAria: text("ลำดับเวลาเรดาร์", "Radar timeline"),
    lastScan: text("ภาพล่าสุด", "Last scan"),
    radarIntensityLegend: text("คำอธิบายระดับความแรงของเรดาร์", "Radar intensity legend"),
    light: text("เบา", "Light"),
    heavy: text("หนัก", "Heavy"),
    weatherPinRiskLegend: text("คำอธิบายความเสี่ยงของหมุดสภาพอากาศ", "Weather pin risk legend"),
    weatherStatus: text("สถานะสภาพอากาศ", "Weather status"),
    radarFallbackHelp: text("เรดาร์กำลังโหลด หมุดพยากรณ์สดยังใช้งานได้", "Radar is loading; live forecast pins remain available."),
  };
}

export function weatherConditionLabel(value: WeatherCondition | string | null | undefined, language: Language) {
  if (language !== "th") return value ?? "Unknown";
  return ({
    Clear: "ท้องฟ้าแจ่มใส",
    Cloudy: "มีเมฆมาก",
    "Partly Cloudy": "มีเมฆบางส่วน",
    Rain: "ฝนตก",
    Thunderstorms: "ฝนฟ้าคะนอง",
  } as Record<string, string>)[value ?? ""] ?? value ?? "ยังไม่มีข้อมูลยืนยัน";
}

export function weatherRiskLabel(value: WeatherRiskLevel, language: Language) {
  if (value === "HIGH") return localizedText(language, "ความเสี่ยงสูง", "High impact");
  if (value === "MEDIUM") return localizedText(language, "ควรเฝ้าระวัง", "Medium impact");
  return localizedText(language, "สภาพอากาศปกติ", "Low impact");
}

export function weatherRiskShortLabel(value: WeatherRiskLevel, language: Language) {
  if (value === "HIGH") return localizedText(language, "สูง", "Critical");
  if (value === "MEDIUM") return localizedText(language, "เฝ้าระวัง", "Watch");
  return localizedText(language, "ปกติ", "Normal");
}

export function weatherScopeLabel(value: "myanmar" | "thailand" | "all", language: Language) {
  if (value === "myanmar") return "Myanmar";
  if (value === "thailand") return "Thailand · Tak";
  return localizedText(language, "ทุกพื้นที่", "All locations");
}

export function weatherMapLayerLabel(value: WeatherMapLayerValue, language: Language) {
  if (language !== "th") {
    return ({ radar: "Radar", cloud: "Cloud pins", rain: "Rain pins", wind: "Wind pins", temperature: "Temp pins" } as Record<WeatherMapLayerValue, string>)[value];
  }
  return ({ radar: "เรดาร์", cloud: "หมุดเมฆ", rain: "หมุดฝน", wind: "หมุดลม", temperature: "หมุดอุณหภูมิ" } as Record<WeatherMapLayerValue, string>)[value];
}

export function weatherCacheStatusLabel(status: "live" | "cached" | "stale", ageSeconds: number, language: Language) {
  const age = Math.max(1, Math.floor(ageSeconds / 60));
  if (status === "stale") return localizedText(language, `ข้อมูลล่าสุดที่ใช้งานได้ (${age} นาทีที่แล้ว)`, `last-known-good (${age} min old)`);
  if (status === "cached") return localizedText(language, `ข้อมูลจากแคชเซิร์ฟเวอร์ (${age} นาทีที่แล้ว)`, `server cache (${age} min old)`);
  return localizedText(language, "ข้อมูลสดล่าสุด", "live snapshot");
}

export function weatherRadarCacheStatusLabel(status: "live" | "cached" | "stale", language: Language) {
  if (status === "stale") return localizedText(language, "ข้อมูลสำรองจากแคช", "cached fallback");
  if (status === "cached") return localizedText(language, "ภาพเรดาร์จากแคช", "cached scan");
  return localizedText(language, "ภาพเรดาร์สด", "live scan");
}

export function weatherCountryLabel(value: WeatherCountry, language: Language) {
  if (language !== "th") return value;
  if (value === "Myanmar") return "Myanmar";
  return "Thailand";
}

export function weatherForecastDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === "th" ? "th-TH-u-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function weatherForecastWeekday(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === "th" ? "th-TH-u-nu-latn" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function weatherHourlyLabel(pointLabel: string, language: Language) {
  return pointLabel === "Now" ? localizedText(language, "ขณะนี้", "Now") : pointLabel;
}

export function weatherAlertCopy(alert: WeatherAlert, locations: WeatherLocation[], language: Language) {
  if (language !== "th") return alert;
  const names = alert.locationIds.map((id) => locations.find((location) => location.id === id)?.name).filter(Boolean).join(", ");
  const metric = alert.metric.replace("% peak probability", "% โอกาสสูงสุด").replace(" / 7 days", " / 7 วัน").replace(" / 24 hours", " / 24 ชั่วโมง");
  if (alert.id === "alert-live-severe-rain") return { ...alert, title: "พื้นที่เฝ้าระวังฝนตกหนัก", description: `${names} มีโอกาสฝนตกสูงจากพยากรณ์ล่าสุด`, metric };
  if (alert.id === "alert-live-heavy-rain") return { ...alert, title: "ช่วงฝนตกหนักควรทบทวนเส้นทาง", description: `${names} มีปริมาณฝนเกินเกณฑ์วางแผนงานเกษตรในช่วง 7 วัน`, metric };
  return { ...alert, title: "ควรวางแผนเส้นทางที่มีฝน", description: `${names} มีปริมาณฝนสูงในช่วง 24 ชั่วโมงล่าสุด`, metric };
}
