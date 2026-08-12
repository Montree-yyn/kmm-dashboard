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
  const [types, locations, client, api, live, page, map] = await Promise.all([
    access(new URL("../src/modules/weather/weather.types.ts", import.meta.url)),
    read("src/modules/weather/data/weather.locations.ts"),
    read("src/modules/weather/weather.client.ts"),
    read("app/api/weather/route.ts"),
    read("src/modules/weather/data/weather.live.ts"),
    read("src/modules/weather/WeatherPage.tsx"),
    read("src/modules/weather/WeatherMap.tsx"),
  ]);

  assert.ok(types === undefined);
  assert.equal((locations.match(/id: "MM-/g) ?? []).length, 6);
  assert.equal((locations.match(/id: "TH-/g) ?? []).length, 5);
  assert.match(client, /\/api\/weather/);
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
  assert.match(api, /verifyFirebaseRequest/);
  assert.match(api, /fetchLiveWeather/);
  assert.match(live, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(live, /forecast_days: "7"/);
  assert.match(live, /past_days: "1"/);
  assert.match(live, /OPEN_METEO_TIMEOUT_MS/);
  assert.match(live, /OPEN_METEO_MAX_ATTEMPTS/);
  assert.match(live, /lastKnownGoodWeather/);
  assert.match(api, /refresh/);
  assert.match(page, /Weather Overview/);
  assert.match(page, /7-Day Forecast/);
  assert.match(page, /Agriculture Impact/);
  assert.match(page, /Weather Alerts/);
  assert.match(page, /Recommended Actions/);
  assert.match(page, /Open-Meteo live forecast/);
  assert.doesNotMatch(page, /weather\.mock/);
  assert.match(page, /xl:grid-cols-2/);
  assert.match(page, /lg:grid-cols-3/);
  assert.doesNotMatch(page, /Map placeholder/);
  assert.match(map, /maplibre-gl/);
  assert.match(map, /NavigationControl/);
  assert.match(map, /createMarketingBasemapStyle/);
  assert.match(map, /registerPmtilesProtocol/);
  assert.match(map, /getMapDataset\("mm-townships-pmtiles"\)/);
  assert.match(map, /myanmar-states\.geojson/);
  assert.match(map, /myanmar-townships\.geojson/);
  assert.match(map, /aria-pressed/);
  assert.match(map, /h-\[520px\]/);
  assert.match(map, /md:h-\[620px\]/);
  assert.match(map, /xl:h-\[680px\]/);
});
