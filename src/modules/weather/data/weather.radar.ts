import type { WeatherCacheStatus, WeatherRadarPayload } from "../weather.types";

type RainViewerFrame = {
  time?: number;
  path?: string;
};

type RainViewerResponse = {
  host?: string;
  generated?: number;
  radar?: {
    past?: RainViewerFrame[];
  };
};

const RAINVIEWER_ENDPOINT = "https://api.rainviewer.com/public/weather-maps.json";
const RAINVIEWER_TIMEOUT_MS = 8_000;
const RAINVIEWER_CACHE_TTL_MS = 5 * 60 * 1000;
const RAINVIEWER_FRAME_LIMIT = 12;

type RadarCacheEntry = {
  payload: WeatherRadarPayload;
  storedAt: number;
};

let radarCache: RadarCacheEntry | null = null;

export async function fetchWeatherRadar(options: { forceRefresh?: boolean } = {}) {
  const cached = radarCache;
  const cachedAge = cached ? Date.now() - cached.storedAt : Infinity;
  if (!options.forceRefresh && cached && cachedAge < RAINVIEWER_CACHE_TTL_MS) {
    return withCacheMetadata(cached.payload, "cached", cached.storedAt);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RAINVIEWER_TIMEOUT_MS);
  try {
    const response = await fetch(RAINVIEWER_ENDPOINT, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RainViewer request failed (${response.status}).`);

    const payload = (await response.json()) as RainViewerResponse;
    const host = normalizeRainViewerHost(payload.host);
    const frames = (payload.radar?.past ?? [])
      .filter((frame): frame is { time: number; path: string } => (
        typeof frame.time === "number" && Number.isFinite(frame.time) && typeof frame.path === "string" && frame.path.startsWith("/")
      ))
      .slice(-RAINVIEWER_FRAME_LIMIT);
    if (!host || !frames.length) throw new Error("RainViewer returned no radar frames.");

    const livePayload: WeatherRadarPayload = {
      source: "rainviewer",
      sourceLabel: "RainViewer radar",
      host,
      fetchedAt: new Date().toISOString(),
      generatedAt: new Date((payload.generated ?? frames[frames.length - 1].time) * 1000).toISOString(),
      cacheStatus: "live",
      cacheAgeSeconds: 0,
      frames,
    };
    radarCache = { payload: livePayload, storedAt: Date.now() };
    return livePayload;
  } catch (error) {
    if (cached) return withCacheMetadata(cached.payload, "stale", cached.storedAt);
    throw error instanceof Error ? error : new Error("Unable to load RainViewer radar.");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRainViewerHost(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function withCacheMetadata(payload: WeatherRadarPayload, cacheStatus: WeatherCacheStatus, storedAt: number) {
  return {
    ...payload,
    cacheStatus,
    cacheAgeSeconds: Math.max(0, Math.floor((Date.now() - storedAt) / 1000)),
  } satisfies WeatherRadarPayload;
}
