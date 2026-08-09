import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Executive Intelligence is controlled by a centralized read-only snapshot and thresholds", async () => {
  const [engine, business] = await Promise.all([
    read("lib/kai/executive-intelligence.ts"),
    read("lib/kai/tools/kmm-business.ts"),
  ]);
  assert.match(engine, /EXECUTIVE_THRESHOLDS/);
  assert.match(engine, /buildExecutiveSnapshot/);
  assert.match(engine, /deriveExecutiveSignals/);
  assert.match(engine, /targetProgress/);
  assert.match(engine, /Stock Cover Proxy/);
  assert.doesNotMatch(engine, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(business, /isExecutiveQuestion/);
  assert.match(business, /getExecutiveAnswer/);
  assert.match(business, /KMM Internal Data/);
});

test("Executive rules keep Target versions, product limitations, and recommendations explainable", async () => {
  const engine = await read("lib/kai/executive-intelligence.ts");
  assert.match(engine, /TARGET_MATERIAL_GAP/);
  assert.match(engine, /TARGET_AHEAD/);
  assert.match(engine, /HIGH_STOCK_LOW_SALES/);
  assert.match(engine, /ZERO_SALES_WITH_STOCK/);
  assert.match(engine, /BOOKING_WEAKENING/);
  assert.match(engine, /GP_PRESSURE/);
  assert.match(engine, /signal, not a causal finding/);
  assert.match(engine, /product === "TT" \|\| product === "CH"/);
});

test("Phase 5A alerts are deterministic, grouped, read-only, and KAI-routable", async () => {
  const [alerts, business] = await Promise.all([read("lib/kai/executive-alerts.ts"), read("lib/kai/tools/kmm-business.ts")]);
  assert.match(alerts, /evaluateExecutiveAlerts/);
  assert.match(alerts, /ZERO_SALES_WITH_STOCK/);
  assert.match(alerts, /stockSnapshotDate/);
  assert.match(alerts, /KMM Internal Data/);
  assert.doesNotMatch(alerts, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(business, /ALERT_REQUEST/);
  assert.match(business, /getAlertAnswer/);
});

test("Phase 5B briefing is deterministic, scoped, MTD-safe, and forbids forecast language", async () => {
  const [briefing, business] = await Promise.all([read("lib/kai/executive-briefing.ts"), read("lib/kai/tools/kmm-business.ts")]);
  assert.match(briefing, /composeExecutiveBriefing/); assert.match(briefing, /ข้อมูล Stock ณ วันที่/); assert.match(briefing, /MTD/); assert.match(briefing, /isSafeBriefingNarrative/);
  assert.match(business, /BRIEFING_REQUEST/); assert.match(business, /getBriefingAnswer/); assert.doesNotMatch(briefing, /forecast\(/i);
});

test("Phase 4B keeps cross-metric relationships, priorities, and no-causality guardrails deterministic", async () => {
  const [engine, business] = await Promise.all([
    read("lib/kai/executive-intelligence.ts"),
    read("lib/kai/tools/kmm-business.ts"),
  ]);
  assert.match(engine, /SALES_GAP_BOOKING_IMPROVING/);
  assert.match(engine, /SALES_GAP_BOOKING_WEAKENING/);
  assert.match(engine, /INVENTORY_PRESSURE_BOOKING_IMPROVING/);
  assert.match(engine, /rankExecutivePriorities/);
  assert.match(engine, /not an AI score/);
  assert.match(business, /executiveWhyAnswer/);
  assert.match(business, /executiveProductAnswer/);
  assert.match(business, /executiveBranchAnswer/);
  assert.match(business, /ยังไม่มี Target ระดับสาขา/);
});

test("Phase 4B.1 groups repeated product signals, keeps subjects visible, and preserves evidence", async () => {
  const [engine, business, narrative] = await Promise.all([
    read("lib/kai/executive-intelligence.ts"),
    read("lib/kai/tools/kmm-business.ts"),
    read("lib/kai/executive-narrative.ts"),
  ]);
  assert.match(engine, /groupExecutiveSignals/);
  assert.match(engine, /selectExecutiveSignalGroups/);
  assert.match(engine, /subjects: string\[\]/);
  assert.match(engine, /ZERO_SALES_WITH_STOCK/);
  assert.match(business, /EX และ TP|subjects\.join/);
  assert.match(business, /mentionedProducts/);
  assert.match(engine, /เร่งติดตามการขาย/);
  assert.match(narrative, /allowedSubjects/);
  assert.match(narrative, /inventorySubjects/);
});

test("Phase 4B Fact Lock discards false-number and causal Qwen prose", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kmm-executive-narrative-"));
  try {
    const source = await read("lib/kai/executive-narrative.ts");
    const output = ts.transpileModule(source, {
      compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: "executive-narrative.ts",
    }).outputText;
    const destination = join(directory, "executive-narrative.js");
    await writeFile(destination, output);
    const narrative = await import(`file://${destination}`);
    assert.equal(narrative.isSafeExecutiveNarrative("ข้อมูลบ่งชี้ว่าควรติดตามคุณภาพกำไร"), true);
    assert.equal(narrative.isSafeExecutiveNarrative("ข้อมูลบ่งชี้ว่าควรติดตาม EX", ["EX"]), true);
    assert.equal(narrative.isSafeExecutiveNarrative("ข้อมูลบ่งชี้ว่าควรติดตาม CH", ["EX"]), false);
    assert.equal(narrative.isSafeExecutiveNarrative("Sales 99 units"), false);
    assert.equal(narrative.isSafeExecutiveNarrative("สาเหตุคือยอดจองลดลง"), false);
    const result = await narrative.composeExecutiveNarrative(
      { complete: async () => ({ answer: "Sales 99 units", model: "mock", fallbackUsed: false, usage: null }) },
      { period: { start: "2026-07-01", end: "2026-07-31", scopeLabel: "July 2026" }, sales: { units: 43, value: 1, gp: 1, gpPercent: 1 }, booking: { units: 1, value: 1 }, stock: { units: 1, value: 1, snapshotDate: null }, target: null, progress: null, products: [], branches: [] },
      [],
      [],
    );
    assert.equal(result.rejected, true);
    assert.doesNotMatch(result.text, /99/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
