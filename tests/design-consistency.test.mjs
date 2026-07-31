import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("approved pages share the Golden Reference shell tokens", async () => {
  const [dashboard, marketing, sales, shell] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);

  for (const page of [dashboard, marketing, sales]) {
    assert.match(page, /bg-\[var\(--surface-canvas\)\]/);
    assert.match(page, /text-\[var\(--text-primary\)\]/);
    assert.doesNotMatch(page, /bg-\[#EF4444\]/);
  }
  assert.match(shell, /data-global-app-shell/);
});

test("Dashboard and Sales use the same executive page hierarchy", async () => {
  const [dashboard, sales] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
  ]);

  for (const page of [dashboard, sales]) {
    assert.match(page, /min-h-\[calc\(100vh-72px\)\]/);
    assert.match(page, /max-w-\[1600px\]/);
    assert.match(page, /p-4 sm:p-5 xl:p-6/);
    assert.match(page, /mb-2 h-1 w-8 rounded-full bg-\[var\(--brand-500\)\]/);
    assert.match(page, /text-\[28px\].*sm:text-\[30px\]/);
    assert.match(page, /repeat\(5,minmax\(0,1fr\)\)/);
  }
});

test("Dashboard and Sales filters share accessible control geometry", async () => {
  const [dashboard, sales] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
  ]);

  for (const page of [dashboard, sales]) {
    assert.match(page, /aria-haspopup="listbox"/);
    assert.match(page, /aria-label=\{`\$\{label\} filter`\}/);
    assert.match(page, /role="listbox"/);
    assert.match(page, /event\.key === "Escape"/);
    assert.match(page, /flex h-11 w-full/);
    assert.match(page, /focus-visible:ring-4/);
  }
});

test("Dashboard and Sales analytics share card and chart contracts", async () => {
  const [dashboard, sales, kpiCard] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/design-system/kpi-card.tsx"),
  ]);

  for (const page of [dashboard, sales]) {
    assert.match(page, /import \{ KpiCard \}/);
    assert.match(page, /<KpiCard[\s\S]*?variant="executive"/);
    assert.match(page, /\[&>header_button\]:!h-11/);
    assert.match(page, /\[&>header_select\]:!h-11/);
    assert.match(page, /aria-live="assertive"/);
  }
  assert.match(kpiCard, /min-h-\[160px\]/);
  assert.match(kpiCard, /shadow-\[var\(--shadow-card\)\]/);
  assert.match(kpiCard, /hover:shadow-\[var\(--shadow-hover\)\]/);
});

test("Marketing retains the approved compact workspace exception", async () => {
  const marketing = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );

  assert.match(marketing, /data-marketing-workspace="true"/);
  assert.match(marketing, /h-\[calc\(100vh-72px\)\]/);
  assert.match(marketing, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(marketing, /inline-flex h-11 min-w-28/);
  assert.match(marketing, /kmm-compare-control inline-flex h-11/);
  assert.match(marketing, /transition-colors hover:bg/);
});
