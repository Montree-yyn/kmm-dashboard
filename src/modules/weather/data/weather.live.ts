import { weatherLocationSeeds } from "./weather.locations";
import { getWeatherRiskLevel } from "./weather.rules";
import { normalizeWeatherContract } from "../weather.contract";
import type {
  WeatherCondition,
  WeatherCacheStatus,
  WeatherDataPayload,
  WeatherForecastDay,
  WeatherHourlyPoint,
  WeatherLocation,
  WeatherLocationSeed,
} from "../weather.types";

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  wind_speed_10m?: number;
  weather_code?: number;
};

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: Array<number | null>;
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
};

type OpenMeteoHourly = {
  time?: string[];
  temperature_2m?: Array<number | null>;
  precipitation_probability?: Array<number | null>;
  precipitation?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  weather_code?: Array<number | null>;
};

type OpenMeteoLocationResponse = {
  current?: OpenMeteoCurrent;
  daily?: OpenMeteoDaily;
  hourly?: OpenMeteoHourly;
  timezone?: string;
};

const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_TIMEOUT_MS = 12_000;
const OPEN_METEO_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;
const LIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const LAST_KNOWN_GOOD_MAX_AGE_MS = 30 * 60 * 1000;

type FetchLiveWeatherOptions = {
  forceRefresh?: boolean;
  seeds?: WeatherLocationSeed[];
};

type WeatherCacheEntry = {
  payload: WeatherDataPayload;
  storedAt: number;
};

class OpenMeteoRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "OpenMeteoRequestError";
    this.retryable = retryable;
  }
}

let lastKnownGoodWeather: WeatherCacheEntry | null = null;

export async function fetchLiveWeather(
  options: FetchLiveWeatherOptions = {},
): Promise<WeatherDataPayload> {
  const { forceRefresh = false, seeds = weatherLocationSeeds } = options;
  const cacheable = isDefaultLocationSet(seeds);
  const cached = cacheable ? lastKnownGoodWeather : null;
  const cachedAge = cached ? Date.now() - cached.storedAt : Infinity;
  if (!forceRefresh && cached && cachedAge < LIVE_CACHE_TTL_MS) {
    return withCacheMetadata(cached.payload, "cached", cached.storedAt);
  }

  const query = new URLSearchParams({
    latitude: seeds.map((location) => location.latitude).join(","),
    longitude: seeds.map((location) => location.longitude).join(","),
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
    hourly: "temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    past_days: "1",
    forecast_days: "7",
    timezone: "auto",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });
  const apiKey = process.env.OPEN_METEO_API_KEY;
  if (apiKey) query.set("apikey", apiKey);

  try {
    const response = await fetchOpenMeteo(`${OPEN_METEO_ENDPOINT}?${query.toString()}`);
    const payload = (await response.json()) as OpenMeteoLocationResponse | OpenMeteoLocationResponse[];
    const responses = Array.isArray(payload) ? payload : [payload];
    if (responses.length !== seeds.length) {
      throw new Error("Open-Meteo returned an unexpected number of locations.");
    }

    const locations = responses.map((weather, index) => mapWeatherLocation(seeds[index], weather));
    const basePayload = {
      source: "open-meteo",
      sourceLabel: apiKey ? "Open-Meteo live forecast" : "Open-Meteo public live forecast",
      fetchedAt: new Date().toISOString(),
      cacheStatus: "live",
      cacheAgeSeconds: 0,
      locations,
    } satisfies Omit<WeatherDataPayload, "contract">;
    const livePayload: WeatherDataPayload = {
      ...basePayload,
      contract: normalizeWeatherContract(basePayload),
    };
    if (cacheable) lastKnownGoodWeather = { payload: livePayload, storedAt: Date.now() };
    return livePayload;
  } catch (error) {
    if (cached && cachedAge < LAST_KNOWN_GOOD_MAX_AGE_MS) {
      return withCacheMetadata(cached.payload, "stale", cached.storedAt);
    }
    throw error;
  }
}

async function fetchOpenMeteo(url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= OPEN_METEO_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPEN_METEO_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status >= 500;
      throw new OpenMeteoRequestError(`Open-Meteo request failed (${response.status}).`, retryable);
    } catch (error) {
      const normalizedError = error instanceof Error && error.name === "AbortError"
        ? new OpenMeteoRequestError("Open-Meteo request timed out.", true)
        : error;
      if (normalizedError instanceof OpenMeteoRequestError && !normalizedError.retryable) throw normalizedError;
      lastError = normalizedError;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < OPEN_METEO_MAX_ATTEMPTS) {
      await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to load weather from Open-Meteo.");
}

async function wait(milliseconds: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function isDefaultLocationSet(seeds: WeatherLocationSeed[]) {
  return seeds.length === weatherLocationSeeds.length && seeds.every((seed, index) => seed.id === weatherLocationSeeds[index]?.id);
}

function withCacheMetadata(payload: WeatherDataPayload, cacheStatus: WeatherCacheStatus, storedAt: number): WeatherDataPayload {
  const nextPayload = {
    ...payload,
    cacheStatus,
    cacheAgeSeconds: Math.max(0, Math.floor((Date.now() - storedAt) / 1000)),
  };
  return {
    ...nextPayload,
    contract: normalizeWeatherContract(nextPayload),
  };
}

function mapWeatherLocation(seed: WeatherLocationSeed, weather: OpenMeteoLocationResponse): WeatherLocation {
  const current = weather.current ?? {};
  const daily = weather.daily ?? {};
  const currentDate = current.time?.slice(0, 10) ?? daily.time?.[1] ?? daily.time?.[0] ?? "";
  const forecast = buildForecast(daily, currentDate);
  const location: WeatherLocation = {
    ...seed,
    condition: weatherConditionFromCode(current.weather_code),
    rainRisk: numberAt(daily.precipitation_probability_max, dailyIndexForDate(daily.time, currentDate), 0),
    rainfall24h: trailing24HourRainfall(weather.hourly, current.time),
    temperature: round(numberOr(current.temperature_2m, 0)),
    humidity: round(numberOr(current.relative_humidity_2m, 0)),
    windSpeed: round(numberOr(current.wind_speed_10m, 0)),
    riskLevel: "LOW",
    hourly: buildHourlyForecast(weather.hourly, current.time),
    forecast,
  };
  location.riskLevel = getWeatherRiskLevel(location);
  return location;
}

function buildHourlyForecast(hourly: OpenMeteoHourly | undefined, currentTime: string | undefined): WeatherHourlyPoint[] {
  const times = hourly?.time ?? [];
  if (!times.length) return [];
  const foundIndex = currentTime ? times.findIndex((time) => time >= currentTime) : 0;
  const safeStartIndex = foundIndex >= 0 ? foundIndex : Math.max(0, times.length - 1);
  return times.slice(safeStartIndex, safeStartIndex + 12).map((time, offset) => {
    const index = safeStartIndex + offset;
    const weatherCode = numberAt(hourly?.weather_code, index, 3);
    return {
      time,
      label: offset === 0 ? "Now" : time.slice(11, 16),
      temperature: round(numberAt(hourly?.temperature_2m, index, 0)),
      rainProbability: round(numberAt(hourly?.precipitation_probability, index, 0)),
      rainfallMm: round(numberAt(hourly?.precipitation, index, 0)),
      windSpeed: round(numberAt(hourly?.wind_speed_10m, index, 0)),
      condition: weatherConditionFromCode(weatherCode),
    };
  });
}

function buildForecast(daily: OpenMeteoDaily, currentDate: string): WeatherForecastDay[] {
  const dates = daily.time ?? [];
  const indexes = dates
    .map((date, index) => ({ date, index }))
    .filter(({ date }) => !currentDate || date >= currentDate)
    .slice(0, 7);

  return indexes.map(({ date, index }) => ({
    date,
    label: formatDate(date),
    weekday: formatWeekday(date),
    rainProbability: round(numberAt(daily.precipitation_probability_max, index, 0)),
    rainfallMm: round(numberAt(daily.precipitation_sum, index, 0)),
    temperatureHigh: round(numberAt(daily.temperature_2m_max, index, 0)),
    temperatureLow: round(numberAt(daily.temperature_2m_min, index, 0)),
  }));
}

function trailing24HourRainfall(hourly: OpenMeteoHourly | undefined, currentTime: string | undefined) {
  const times = hourly?.time ?? [];
  const values = hourly?.precipitation ?? [];
  if (!times.length || !values.length) return 0;
  const lastIndex = currentTime
    ? times.reduce((found, time, index) => (time <= currentTime ? index : found), -1)
    : times.length - 1;
  const end = lastIndex >= 0 ? lastIndex : times.length - 1;
  const start = Math.max(0, end - 23);
  const total = values.slice(start, end + 1).reduce<number>(
    (sum, value) => sum + (typeof value === "number" ? value : 0),
    0,
  );
  return round(total);
}

function weatherConditionFromCode(code: number | undefined): WeatherCondition {
  if (code === 0) return "Clear";
  if (code !== undefined && [1, 2].includes(code)) return "Partly Cloudy";
  if (code === 3 || (code !== undefined && [45, 48].includes(code))) return "Cloudy";
  if (code !== undefined && code >= 95) return "Thunderstorms";
  if (code !== undefined && ((code >= 51 && code <= 67) || (code >= 80 && code <= 86))) return "Rain";
  return "Cloudy";
}

function dailyIndexForDate(dates: string[] | undefined, date: string) {
  const index = dates?.indexOf(date) ?? -1;
  return index >= 0 ? index : 0;
}

function numberAt(values: Array<number | null> | undefined, index: number, fallback: number) {
  return numberOr(values?.[index], fallback);
}

function numberOr(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
