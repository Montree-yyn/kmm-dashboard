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

test("Weather mock covers six Myanmar and five Tak locations", async () => {
  const [types, mock, page] = await Promise.all([
    access(new URL("../src/modules/weather/weather.types.ts", import.meta.url)),
    read("src/modules/weather/data/weather.mock.ts"),
    read("src/modules/weather/WeatherPage.tsx"),
  ]);

  assert.ok(types === undefined);
  assert.equal((mock.match(/id: "MM-/g) ?? []).length, 6);
  assert.equal((mock.match(/id: "TH-/g) ?? []).length, 5);
  assert.match(page, /Weather Overview/);
  assert.match(page, /7-Day Forecast/);
  assert.match(page, /Agriculture Impact/);
  assert.match(page, /Weather Alerts/);
  assert.match(page, /Recommended Actions/);
});
