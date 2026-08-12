import { auth } from "../../../lib/firebase";
import type { WeatherDataPayload } from "./weather.types";

export async function loadLiveWeather(options: { forceRefresh?: boolean } = {}): Promise<WeatherDataPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again.");

  const query = new URLSearchParams({ ts: String(Date.now()) });
  if (options.forceRefresh) query.set("refresh", "1");
  const response = await fetch(`/api/weather?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = (await response.json()) as Partial<WeatherDataPayload> & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Unable to load live weather (${response.status}).`);
  if (payload.source !== "open-meteo" || !Array.isArray(payload.locations)) {
    throw new Error("Live weather returned an invalid response.");
  }
  return payload as WeatherDataPayload;
}
