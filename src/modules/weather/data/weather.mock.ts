import type {
  WeatherAlert,
  WeatherCondition,
  WeatherForecastDay,
  WeatherLocation,
  WeatherRiskLevel,
} from "../weather.types";

const forecastDays = [
  ["12 Aug", "Wed"],
  ["13 Aug", "Thu"],
  ["14 Aug", "Fri"],
  ["15 Aug", "Sat"],
  ["16 Aug", "Sun"],
  ["17 Aug", "Mon"],
  ["18 Aug", "Tue"],
] as const;

type LocationSeed = {
  id: string;
  branchCode: string;
  name: string;
  country: "Myanmar" | "Thailand";
  region: string;
  latitude: number;
  longitude: number;
  mapX: number;
  mapY: number;
  condition: WeatherCondition;
  rainRisk: number;
  rainfall24h: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  riskLevel: WeatherRiskLevel;
};

const seeds: LocationSeed[] = [
  { id: "MM-HPA", branchCode: "KMM01", name: "Hpa-an", country: "Myanmar", region: "Kayin", latitude: 16.89, longitude: 97.63, mapX: 45, mapY: 45, condition: "Thunderstorms", rainRisk: 72, rainfall24h: 58, temperature: 27, humidity: 86, windSpeed: 8, riskLevel: "HIGH" },
  { id: "MM-MAW", branchCode: "KMM02", name: "Mawlamyine", country: "Myanmar", region: "Mon", latitude: 16.49, longitude: 97.63, mapX: 42, mapY: 52, condition: "Rain", rainRisk: 66, rainfall24h: 42, temperature: 28, humidity: 82, windSpeed: 10, riskLevel: "MEDIUM" },
  { id: "MM-THA", branchCode: "KMM03", name: "Tharyarwaddy", country: "Myanmar", region: "Bago", latitude: 17.65, longitude: 95.78, mapX: 31, mapY: 38, condition: "Cloudy", rainRisk: 44, rainfall24h: 18, temperature: 30, humidity: 78, windSpeed: 12, riskLevel: "MEDIUM" },
  { id: "MM-NAT", branchCode: "KMM04", name: "Nattalin", country: "Myanmar", region: "Bago", latitude: 18.45, longitude: 95.75, mapX: 31, mapY: 28, condition: "Partly Cloudy", rainRisk: 38, rainfall24h: 12, temperature: 31, humidity: 75, windSpeed: 11, riskLevel: "LOW" },
  { id: "MM-NAU", branchCode: "KMM05", name: "Naung Cho", country: "Myanmar", region: "Shan", latitude: 23.3, longitude: 97, mapX: 39, mapY: 14, condition: "Rain", rainRisk: 54, rainfall24h: 26, temperature: 24, humidity: 80, windSpeed: 7, riskLevel: "MEDIUM" },
  { id: "MM-MYW", branchCode: "KMM06", name: "Myawaddy", country: "Myanmar", region: "Kayin", latitude: 16.69, longitude: 98.51, mapX: 53, mapY: 49, condition: "Thunderstorms", rainRisk: 71, rainfall24h: 48, temperature: 27, humidity: 84, windSpeed: 9, riskLevel: "HIGH" },
  { id: "TH-MTS", branchCode: "KM-TH-01", name: "Mae Sot", country: "Thailand", region: "Tak", latitude: 16.72, longitude: 98.57, mapX: 61, mapY: 52, condition: "Rain", rainRisk: 60, rainfall24h: 35, temperature: 27, humidity: 82, windSpeed: 8, riskLevel: "MEDIUM" },
  { id: "TH-PHP", branchCode: "KM-TH-02", name: "Phop Phra", country: "Thailand", region: "Tak", latitude: 16.32, longitude: 98.69, mapX: 64, mapY: 60, condition: "Thunderstorms", rainRisk: 68, rainfall24h: 44, temperature: 26, humidity: 87, windSpeed: 6, riskLevel: "HIGH" },
  { id: "TH-UMP", branchCode: "KM-TH-03", name: "Umphang", country: "Thailand", region: "Tak", latitude: 16, longitude: 98.86, mapX: 70, mapY: 68, condition: "Thunderstorms", rainRisk: 76, rainfall24h: 62, temperature: 24, humidity: 91, windSpeed: 5, riskLevel: "HIGH" },
  { id: "TH-TSY", branchCode: "KM-TH-04", name: "Tha Song Yang", country: "Thailand", region: "Tak", latitude: 17.23, longitude: 98.22, mapX: 58, mapY: 40, condition: "Rain", rainRisk: 51, rainfall24h: 28, temperature: 25, humidity: 85, windSpeed: 7, riskLevel: "MEDIUM" },
  { id: "TH-MRM", branchCode: "KM-TH-05", name: "Mae Ramat", country: "Thailand", region: "Tak", latitude: 16.98, longitude: 98.52, mapX: 60, mapY: 46, condition: "Cloudy", rainRisk: 42, rainfall24h: 21, temperature: 27, humidity: 80, windSpeed: 9, riskLevel: "LOW" },
];

function createForecast(seed: LocationSeed): WeatherForecastDay[] {
  return forecastDays.map(([label, weekday], index) => ({
    date: "2026-08-" + String(12 + index).padStart(2, "0"),
    label,
    weekday,
    rainProbability: Math.max(18, Math.min(90, seed.rainRisk - index * 5 + (index % 3) * 3)),
    rainfallMm: Math.max(2, Math.round(seed.rainfall24h * (0.72 - index * 0.07))),
    temperatureHigh: seed.temperature + (index % 3),
    temperatureLow: seed.temperature - 3 + (index % 2),
  }));
}

export const weatherLocations: WeatherLocation[] = seeds.map((seed) => ({
  ...seed,
  forecast: createForecast(seed),
}));

export const weatherAlerts: WeatherAlert[] = [
  {
    id: "alert-border-storm",
    title: "Thunderstorm watch near the border",
    description: "Hpa-an, Myawaddy and Phop Phra show elevated storm probability across the next 48 hours.",
    severity: "HIGH",
    metric: "68–82% rain chance",
    locationIds: ["MM-HPA", "MM-MYW", "TH-PHP"],
  },
  {
    id: "alert-umphang-rain",
    title: "Heavy rain window in Umphang",
    description: "Seven-day rainfall is above the agriculture threshold. Confirm route access before field activity.",
    severity: "HIGH",
    metric: "173 mm / 7 days",
    locationIds: ["TH-UMP"],
  },
  {
    id: "alert-tak-routes",
    title: "Wet-route planning needed in Tak",
    description: "Mae Sot and Tha Song Yang may require extra travel time for outdoor visits.",
    severity: "MEDIUM",
    metric: "28–35 mm / 24 hours",
    locationIds: ["TH-MTS", "TH-TSY"],
  },
];
