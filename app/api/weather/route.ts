import { AuthError, verifyFirebaseRequest } from "../../../lib/server/firebase-auth";
import { fetchLiveWeather } from "../../../src/modules/weather/data/weather.live";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await verifyFirebaseRequest(request);
    const payload = await fetchLiveWeather();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "no-store",
        "X-Weather-Source": "Open-Meteo",
      },
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load live weather." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
