import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const returnPath = await tsImport("../lib/auth/return-path.ts", import.meta.url);

test("refresh authentication restores the exact safe application route", async () => {
  const [authGate, loginForm] = await Promise.all([
    read("components/auth/auth-gate.tsx"),
    read("components/auth/login-form.tsx"),
  ]);

  assert.equal(returnPath.safeAppReturnPath("/daily-management?branch=KMM02"), "/daily-management?branch=KMM02");
  assert.equal(returnPath.safeAppReturnPath("https://evil.example/steal"), "/dashboard");
  assert.equal(returnPath.safeAppReturnPath("//evil.example/steal"), "/dashboard");
  assert.equal(returnPath.safeAppReturnPath("/login"), "/dashboard");
  assert.equal(returnPath.loginPathFor("/stock?page=2"), "/login?returnTo=%2Fstock%3Fpage%3D2");
  assert.match(authGate, /loginPathFor\(returnTo\)/);
  assert.match(loginForm, /router\.replace\(returnTo\)/);
  assert.doesNotMatch(loginForm, /router\.replace\("\/dashboard"\)/);
});

test("all application routes share one persistent shell", async () => {
  const [layout, shell, sidebar, header] = await Promise.all([
    read("app/layout.tsx"),
    read("components/layout/global-app-shell.tsx"),
    read("components/navigation/app-sidebar.tsx"),
    read("components/layout/global-header.tsx"),
  ]);

  assert.match(layout, /<GlobalAppShell>/);
  assert.match(shell, /<AuthGate>/);
  assert.match(shell, /<AppSidebar/);
  assert.match(shell, /<GlobalHeader/);
  assert.match(shell, /overflow-x-clip/);
  assert.match(sidebar, /data-global-sidebar/);
  assert.match(sidebar, /aria-hidden=\{!mobileOpen\}/);
  assert.match(sidebar, /inert=\{!mobileOpen\}/);
  assert.match(sidebar, /invisible -translate-x-full pointer-events-none/);
  assert.match(header, /data-global-header/);
});

test("visible navigation order is centralized and hidden modules leave no gaps", async () => {
  const config = await read("components/navigation/navigation-config.ts");
  const items = [
    ...config.matchAll(
      /\{\s*label: "([^"]+)",[^}]*visible: (true|false),?\s*\}/g,
    ),
  ].map((match) => ({ label: match[1], visible: match[2] === "true" }));
  const visibleLabels = items
    .filter((item) => item.visible)
    .map((item) => item.label);

  assert.deepEqual(visibleLabels, [
    "Dashboard",
    "Sales",
    "Booking",
    "Stock",
    "Marketing",
    "Myanmar Map",
    "Weather",
    "Expense",
    "Team",
    "Data Hub",
    "Settings",
  ]);
  for (const label of ["Home", "Customer", "Report", "AI"]) {
    assert.match(
      config,
      new RegExp(`label: "${label}"[\\s\\S]*?visible: false`),
    );
  }
  assert.match(config, /\.filter\(\s*\(item\) => item\.visible/);
});

test("sidebar geometry and nested active state follow the V3.3 compact standard", async () => {
  const [config, sidebar] = await Promise.all([
    read("components/navigation/navigation-config.ts"),
    read("components/navigation/app-sidebar.tsx"),
  ]);

  assert.match(sidebar, /h-12/);
  assert.match(sidebar, /gap-2/);
  assert.match(sidebar, /size-\[22px\]/);
  assert.match(sidebar, /pl-5 pr-4/);
  assert.match(sidebar, /rounded-\[14px\]/);
  assert.match(sidebar, /gap-4/);
  assert.match(sidebar, /text-base font-medium/);
  assert.match(sidebar, /px-3 py-5/);
  assert.match(sidebar, /w-\[72px\]/);
  assert.match(sidebar, /w-\[216px\]/);
  assert.match(sidebar, /shadow-\[inset_1px_0_0_var\(--brand-500\)\]/);
  assert.match(sidebar, /\{renderSidebar\(collapsed\)\}/);
  assert.match(sidebar, /\{renderSidebar\(false\)\}/);
  assert.match(config, /pathname\.startsWith\(`\$\{href\}\/`\)/);
});

test("page components no longer mount their own application navigation", async () => {
  const files = [
    "components/dashboard/dashboard-page.tsx",
    "components/sales/sales-page.tsx",
    "components/booking/booking-intelligence-page.tsx",
    "components/stock/stock-intelligence-page.tsx",
    "components/marketing/marketing-intelligence-page.tsx",
    "components/data-hub/data-hub-page.tsx",
    "components/settings/settings-page.tsx",
  ];
  const sources = await Promise.all(files.map(read));
  for (const source of sources) {
    assert.doesNotMatch(source, /<AppSidebar/);
    assert.doesNotMatch(source, /<SettingsSidebar/);
    assert.doesNotMatch(source, /<KaiHeaderAssistant/);
  }
});
