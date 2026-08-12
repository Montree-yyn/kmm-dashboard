import { AuthError, verifyFirebaseRequest } from "../../../lib/server/firebase-auth";
import { fetchLiveWeather } from "../../../src/modules/weather/data/weather.live";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await verifyFirebaseRequest(request);
    const requestUrl = new URL(request.url);
    const payload = await fetchLiveWeather({
      forceRefresh: requestUrl.searchParams.get("refresh") === "1",
    });
    return Response.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        "X-Weather-Source": "Open-Meteo",
        "X-Weather-Cache": payload.cacheStatus,
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
