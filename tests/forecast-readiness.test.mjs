import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadForecasting() {
  const directory = await mkdtemp(join(tmpdir(), "kmm-forecasting-"));
  const source = await readFile(new URL("../lib/forecasting/readiness.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const destination = join(directory, "readiness.js");
  await writeFile(destination, output);
  return { ...createRequire(import.meta.url)(destination), cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test("forecast readiness excludes partial current month and reports missing/zero periods", async () => {
  const { buildMonthlyActuals, missingMonths, cleanup } = await loadForecasting();
  try {
    const rows = [
      { date: "2026-01-12", quantity: 1, salesValue: 100, gp: 10, product: "01-TT", branch: "KMM01" },
      { date: "2026-03-12", quantity: 0, salesValue: 0, gp: 0, product: "01-TT", branch: "KMM01" },
      { date: "2026-08-02", quantity: 99, salesValue: 99, gp: 9, product: "01-TT", branch: "KMM01" },
    ];
    const actuals = buildMonthlyActuals(rows, "2026-08-09");
    assert.deepEqual(actuals.map((row) => row.month), ["2026-01", "2026-03"]);
    assert.deepEqual(missingMonths(actuals.map((row) => row.month)), ["2026-02"]);
    assert.equal(actuals[1].salesUnits, 0);
  } finally { await cleanup(); }
});

test("transparent baselines and walk-forward errors are deterministic and zero-safe", async () => {
  const { forecast, walkForward, compareBaselines, seasonalitySummary, structuralBreakDiagnostics, walkForwardStability, cleanup } = await loadForecasting();
  try {
    assert.equal(forecast("seasonalNaive", Array.from({ length: 12 }, (_, index) => index + 1)), 1);
    assert.equal(forecast("movingAverage3", [3, 6, 9]), 6);
    assert.equal(forecast("weightedMovingAverage", [3, 6, 9]), 6.9);
    assert.equal(forecast("median3", [1, 100, 3]), 3);
    assert.equal(forecast("trimmedMean6", [1, 2, 3, 4, 5, 100]), 3.5);
    assert.equal(forecast("ewma", [2, 6]), 4);
    assert.equal(forecast("seasonalWeighted", Array.from({ length: 12 }, () => 10)), 10);
    const metrics = walkForward([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 14], "naive", 1);
    assert.equal(metrics.samples, 2);
    assert.equal(metrics.skippedZeroActuals, 1);
    assert.equal(metrics.mae, 13);
    assert.equal(metrics.rmse, Math.sqrt(170));
    assert.equal(metrics.mape, 1);
    assert.equal(metrics.wape, 26 / 14);
    assert.ok(compareBaselines(Array.from({ length: 20 }, (_, index) => index + 1))[1].best);
    const sparse = Array.from({ length: 24 }, (_, index) => ({ month: `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`, salesUnits: index === 0 ? 1 : 0, salesValue: 0, gp: 0, gpPercent: null, rowCount: 0 }));
    assert.equal(seasonalitySummary(sparse).sufficient, false);
    assert.equal(structuralBreakDiagnostics([10, 10, 10, 10, 10, 10, 30, 30, 30, 30, 30, 30]).possibleRegimeChange, true);
    assert.equal(walkForwardStability(Array.from({ length: 16 }, (_, index) => index + 1), "naive").bias, -1);
  } finally { await cleanup(); }
});

test("readiness uses explicit data and WAPE gates rather than a model score", async () => {
  const { classifyReadiness, cleanup } = await loadForecasting();
  try {
    assert.equal(classifyReadiness({ completedMonths: 23, nonZeroMonths: 23, missingRatio: 0, metrics: { wape: 0.01, mae: 1, rmse: 1, mape: 0.01, samples: 10, skippedZeroActuals: 0 } }), "INSUFFICIENT_DATA");
    assert.equal(classifyReadiness({ completedMonths: 30, nonZeroMonths: 30, missingRatio: 0, metrics: { wape: 0.12, mae: 1, rmse: 1, mape: 0.12, samples: 10, skippedZeroActuals: 0 } }), "HIGH_CONFIDENCE");
    assert.equal(classifyReadiness({ completedMonths: 30, nonZeroMonths: 30, missingRatio: 0, metrics: { wape: 0.4, mae: 1, rmse: 1, mape: 0.4, samples: 10, skippedZeroActuals: 0 } }), "NOT_RELIABLE");
    assert.equal(classifyReadiness({ completedMonths: 30, nonZeroMonths: 30, missingRatio: 0, metrics: { wape: 0.2, mae: 1, rmse: 1, mape: 0.2, samples: 10, skippedZeroActuals: 0 }, recentMetrics: { wape: 0.4, mae: 1, rmse: 1, mape: 0.4, samples: 10, skippedZeroActuals: 0 }, possibleRegimeChange: true }), "NOT_RELIABLE");
  } finally { await cleanup(); }
});
