import type {
  SharedWeatherContract,
  SharedWeatherFreshnessStatus,
  SharedWeatherQualityStatus,
  WeatherCacheStatus,
  WeatherLocation,
} from "./weather.types";

type WeatherContractInput = {
  source: string;
  fetchedAt: string;
  cacheStatus: WeatherCacheStatus;
  locations: WeatherLocation[];
};

export function normalizeWeatherContract(input: WeatherContractInput): SharedWeatherContract {
  const qualityStatus = qualityFromCache(input.cacheStatus);
  const freshnessStatus = freshnessFromCache(input.cacheStatus);
  const forecastHorizon = input.locations.reduce(
    (longest, location) => Math.max(longest, location.forecast.length),
    0,
  ) || null;

  return {
    contractVersion: "weather.v1",
    source: input.source,
    provider: input.source,
    model: null,
    runTime: null,
    retrievedAt: input.fetchedAt,
    forecastHorizon,
    qualityStatus,
    freshnessStatus,
    records: input.locations.map((location) => ({
      locationId: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      source: input.source,
      provider: input.source,
      model: null,
      runTime: null,
      validTime: location.forecast[0]?.date ?? null,
      retrievedAt: input.fetchedAt,
      spatialResolution: "point-forecast",
      temperature: location.temperature,
      rainfall: location.rainfall24h,
      humidity: location.humidity,
      wind: location.windSpeed,
      soilMoisture: null,
      forecastHorizon: location.forecast.length || null,
      qualityStatus,
      freshnessStatus,
      coveragePercent: null,
      gridCount: null,
      aggregationMethod: null,
    })),
  };
}

function qualityFromCache(cacheStatus: WeatherCacheStatus): SharedWeatherQualityStatus {
  return cacheStatus === "stale" ? "STALE" : "LIVE";
}

function freshnessFromCache(cacheStatus: WeatherCacheStatus): SharedWeatherFreshnessStatus {
  if (cacheStatus === "live") return "FRESH";
  if (cacheStatus === "cached") return "CACHED";
  return "STALE";
}
