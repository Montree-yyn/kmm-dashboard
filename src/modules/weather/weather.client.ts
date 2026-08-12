import { auth } from "../../../lib/firebase";
import type { WeatherDataPayload } from "./weather.types";

export async function loadLiveWeather(): Promise<WeatherDataPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again.");

  const response = await fetch(`/api/weather?ts=${Date.now()}`, {
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
