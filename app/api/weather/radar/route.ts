import { AuthError, verifyFirebaseRequest } from "../../../../lib/server/firebase-auth";
import { fetchWeatherRadar } from "../../../../src/modules/weather/data/weather.radar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await verifyFirebaseRequest(request);
    const requestUrl = new URL(request.url);
    const payload = await fetchWeatherRadar({
      forceRefresh: requestUrl.searchParams.get("refresh") === "1",
    });
    return Response.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        "X-Weather-Source": "RainViewer",
        "X-Weather-Cache": payload.cacheStatus,
      },
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load weather radar." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
