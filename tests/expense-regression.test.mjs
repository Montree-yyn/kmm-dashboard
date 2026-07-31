import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Expense route preserves authentication and mounts the migrated page", async () => {
  const [route, shell] = await Promise.all([
    read("app/expense/page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);

  assert.match(shell, /<AuthGate>/);
  assert.match(route, /<ExpenseIntelligencePage\s*\/>/);
  assert.doesNotMatch(route, /PlaceholderPage/);
});

test("Expense remains presentation-only while no financial source exists", async () => {
  const page = await read(
    "components/expense/expense-intelligence-page.tsx",
  );

  assert.match(page, /No expense data available/);
  assert.match(page, /verified financial data/);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(page, /\bFirebase\b|firestore|collection\s*\(/i);
  assert.doesNotMatch(page, /<KpiCard/);
  assert.doesNotMatch(page, /mock|fixture|sample expense/i);
});

test("Expense does not fabricate unsupported financial metrics", async () => {
  const page = await read(
    "components/expense/expense-intelligence-page.tsx",
  );

  for (const unsupportedMetric of [
    /title="Total Expense"/,
    /title="Budget"/,
    /title="Actual"/,
    /title="Variance"/,
    /title="Expense Ratio"/,
  ]) {
    assert.doesNotMatch(page, unsupportedMetric);
  }
  assert.doesNotMatch(page, /[><=]\s*\d+(?:\.\d+)?\s*(?:MMK|%)/);
});

test("Expense follows the Golden Reference shell and empty-state contract", async () => {
  const [page, shell, header] = await Promise.all([
    read("components/expense/expense-intelligence-page.tsx"),
    read("components/layout/global-app-shell.tsx"),
    read("components/layout/global-header.tsx"),
  ]);

  assert.match(
    page,
    /kmm-expense-page min-h-\[calc\(100vh-72px\)\] bg-\[var\(--surface-canvas\)\]/,
  );
  assert.match(page, /<h1[\s\S]*?id="expense-title"/);
  assert.match(page, /aria-labelledby="expense-empty-title"/);
  assert.match(header, /h-\[72px\]/);
  assert.match(page, /max-w-\[1600px\]/);
  assert.match(header, /size-11/);
  assert.match(header, /focus-visible:ring-2/);
  assert.match(shell, /motion-reduce:transition-none/);
  assert.doesNotMatch(page, /min-w-\[\d+px\]/);
});

test("Expense migration does not duplicate the shared KPI presentation", async () => {
  const [page, card] = await Promise.all([
    read("components/expense/expense-intelligence-page.tsx"),
    read("components/design-system/kpi-card.tsx"),
  ]);

  assert.doesNotMatch(page, /data-kpi-zone=/);
  assert.doesNotMatch(page, /function (?:Expense)?KpiCard/);
  assert.match(card, /grid-rows-\[24px_48px_40px_14px\]/);
  assert.match(card, /variant\?: "executive" \| "legacy"/);
});
