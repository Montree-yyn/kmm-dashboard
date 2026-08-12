import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Weather is wired into the active navigation and shell", async () => {
  const [navigation, shell, header, route] = await Promise.all([
    read("components/navigation/navigation-config.ts"),
    read("components/layout/global-app-shell.tsx"),
    read("components/layout/global-header.tsx"),
    read("app/weather/page.tsx"),
  ]);

  assert.match(navigation, /label: "Weather"/);
  assert.match(navigation, /href: "\/weather"/);
  assert.match(shell, /"\/weather"/);
  assert.match(header, /prefix: "\/weather"/);
  assert.match(route, /WeatherPage/);
});

test("Weather uses live Open-Meteo data for six Myanmar and five Tak locations", async () => {
  const [types, locations, client, api, radarApi, live, radarData, page, map] = await Promise.all([
    access(new URL("../src/modules/weather/weather.types.ts", import.meta.url)),
    read("src/modules/weather/data/weather.locations.ts"),
    read("src/modules/weather/weather.client.ts"),
    read("app/api/weather/route.ts"),
    read("app/api/weather/radar/route.ts"),
    read("src/modules/weather/data/weather.live.ts"),
    read("src/modules/weather/data/weather.radar.ts"),
    read("src/modules/weather/WeatherPage.tsx"),
    read("src/modules/weather/WeatherMap.tsx"),
  ]);

  assert.ok(types === undefined);
  assert.equal((locations.match(/id: "MM-/g) ?? []).length, 6);
  assert.equal((locations.match(/id: "TH-/g) ?? []).length, 5);
  assert.match(client, /\/api\/weather/);
  assert.match(client, /\/api\/weather\/radar/);
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
  assert.match(api, /verifyFirebaseRequest/);
  assert.match(api, /fetchLiveWeather/);
  assert.match(radarApi, /verifyFirebaseRequest/);
  assert.match(radarApi, /fetchWeatherRadar/);
  assert.match(live, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(live, /precipitation_probability/);
  assert.match(live, /buildHourlyForecast/);
  assert.match(live, /forecast_days: "7"/);
  assert.match(live, /past_days: "1"/);
  assert.match(live, /OPEN_METEO_TIMEOUT_MS/);
  assert.match(live, /OPEN_METEO_MAX_ATTEMPTS/);
  assert.match(live, /lastKnownGoodWeather/);
  assert.match(api, /refresh/);
  assert.match(radarData, /api\.rainviewer\.com\/public\/weather-maps\.json/);
  assert.match(radarData, /RAINVIEWER_CACHE_TTL_MS/);
  assert.match(radarData, /RAINVIEWER_FRAME_LIMIT/);
  assert.match(page, /Weather Overview/);
  assert.match(page, /w-full min-w-0 max-w-full overflow-x-clip/);
  assert.match(page, /mx-auto w-full max-w-\[1600px\]/);
  assert.match(page, /Current conditions/);
  assert.match(page, /Operating areas/);
  assert.match(page, /Next 12 hours/);
  assert.match(page, /formatWeatherNumber/);
  assert.match(page, /7-Day Forecast/);
  assert.match(page, /Agriculture Impact/);
  assert.match(page, /Weather Alerts/);
  assert.match(page, /Recommended Actions/);
  assert.match(page, /Forecast: Open-Meteo/);
  assert.doesNotMatch(page, /weather\.mock/);
  assert.match(page, /xl:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(320px,0\.78fr\)\]/);
  assert.match(page, /lg:grid-cols-3/);
  assert.doesNotMatch(page, /Map placeholder/);
  assert.match(map, /maplibre-gl/);
  assert.match(map, /NavigationControl/);
  assert.match(map, /createMarketingBasemapStyle/);
  assert.match(map, /registerPmtilesProtocol/);
  assert.match(map, /getMapDataset\("mm-townships-pmtiles"\)/);
  assert.match(map, /myanmar-states\.geojson/);
  assert.match(map, /myanmar-townships\.geojson/);
  assert.match(map, /WeatherRadarPayload/);
  assert.match(map, /weather-radar-layer/);
  assert.match(map, /const pin = document\.createElement\("span"\)/);
  assert.match(map, /setLngLat\(\[location\.longitude, location\.latitude\]\)/);
  assert.match(map, /pin\.style\.transform = hovered \? "scale\(1\.12\)" : "scale\(1\)"/);
  assert.doesNotMatch(map, /element\.style\.transform\s*=/);
  assert.match(map, /const MAP_MAX_ZOOM = 15/);
  assert.match(map, /const RADAR_TILE_MAX_ZOOM = 7/);
  assert.match(map, /maxzoom: RADAR_TILE_MAX_ZOOM/);
  assert.match(map, /MAP_PIN_FOCUS_ZOOM/);
  assert.match(map, /map\.flyTo\(/);
  assert.match(map, /maxZoom: MAP_OVERVIEW_ZOOM/);
  assert.match(map, /Reset map to Myanmar overview/);
  assert.match(map, /getWeatherPinIcon\(activeLayer\)/);
  assert.match(map, /const isRadarDataPin = activeLayer === "radar"/);
  assert.match(map, /temperature\.textContent = `\$\{location\.temperature\}°`/);
  assert.match(map, /rain\.textContent = `\$\{location\.rainRisk\}% rain`/);
  assert.match(map, /tooltip\.textContent = `\$\{location\.name\}/);
  assert.match(map, /const showLabel = selected \|\| location\.id === "MM-THA"/);
  assert.match(map, /zIndex: selected \? "4" : showLabel \? "3" : "1"/);
  assert.match(map, /const RISK_LABELS/);
  assert.match(map, /LOW: "Normal"/);
  assert.match(map, /MEDIUM: "Watch"/);
  assert.match(map, /HIGH: "Critical"/);
  assert.match(map, /backdropFilter: "blur\(8px\) saturate\(1\.08\)"/);
  assert.match(map, /Weather pin risk legend/);
  assert.match(map, /aria-label="Weather map controls"/);
  assert.match(map, /md:h-\[520px\]/);
  assert.match(map, /xl:h-\[620px\]/);
  assert.match(map, /sm:flex-row sm:items-center sm:justify-between/);
  assert.doesNotMatch(map, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(240px,280px\)\]/);
  assert.doesNotMatch(map, /absolute left-3 top-3 z-10 hidden md:block/);
  assert.match(map, /tilecache|radar\.host/);
  assert.match(map, /RainViewer/);
  assert.match(map, /Radar timeline/);
  assert.match(map, /aria-pressed/);
  assert.match(map, /h-auto/);
  assert.match(map, /Map controls/);
  assert.match(map, /<details className="group mt-3">/);
  assert.match(map, /requestFullscreen/);
  assert.match(map, /Exit weather map fullscreen/);
  assert.match(map, /Open weather map fullscreen/);
  assert.match(map, /document\.addEventListener\("fullscreenchange"/);
  assert.match(map, /isFullscreen && "fixed inset-0 z-\[120\]/);
  assert.match(locations, /name: "Tharyawaddy"/);
});
