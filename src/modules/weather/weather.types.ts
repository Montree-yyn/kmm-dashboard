export type WeatherCountry = "Myanmar" | "Thailand";

export type WeatherRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type WeatherCacheStatus = "live" | "cached" | "stale";

export type WeatherCondition =
  | "Clear"
  | "Cloudy"
  | "Partly Cloudy"
  | "Rain"
  | "Thunderstorms";

export type WeatherLocationSeed = {
  id: string;
  branchCode: string;
  name: string;
  country: WeatherCountry;
  region: string;
  latitude: number;
  longitude: number;
  mapX: number;
  mapY: number;
};

export type WeatherForecastDay = {
  date: string;
  label: string;
  weekday: string;
  rainProbability: number;
  rainfallMm: number;
  temperatureHigh: number;
  temperatureLow: number;
};

export type WeatherHourlyPoint = {
  time: string;
  label: string;
  temperature: number;
  rainProbability: number;
  rainfallMm: number;
  windSpeed: number;
  condition: WeatherCondition;
};

export type WeatherLocation = {
  id: string;
  branchCode: string;
  name: string;
  country: WeatherCountry;
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
  hourly: WeatherHourlyPoint[];
  forecast: WeatherForecastDay[];
};

export type WeatherAlert = {
  id: string;
  title: string;
  description: string;
  severity: WeatherRiskLevel;
  metric: string;
  locationIds: string[];
};

export type WeatherDataPayload = {
  source: "open-meteo";
  sourceLabel: string;
  fetchedAt: string;
  cacheStatus: WeatherCacheStatus;
  cacheAgeSeconds: number;
  locations: WeatherLocation[];
};

export type WeatherRadarFrame = {
  time: number;
  path: string;
};

export type WeatherRadarPayload = {
  source: "rainviewer";
  sourceLabel: string;
  host: string;
  fetchedAt: string;
  generatedAt: string;
  cacheStatus: WeatherCacheStatus;
  cacheAgeSeconds: number;
  frames: WeatherRadarFrame[];
};
