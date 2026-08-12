export type WeatherCountry = "Myanmar" | "Thailand";

export type WeatherRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type WeatherCondition =
  | "Cloudy"
  | "Partly Cloudy"
  | "Rain"
  | "Thunderstorms";

export type WeatherForecastDay = {
  date: string;
  label: string;
  weekday: string;
  rainProbability: number;
  rainfallMm: number;
  temperatureHigh: number;
  temperatureLow: number;
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
