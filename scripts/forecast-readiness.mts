#!/usr/bin/env npx tsx
/** Local-only Phase 4C discovery report. It only reads the Miniflare D1 file. */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { buildMonthlyActuals, classifyReadiness, compareBaselines, detectOutliers, longestContiguousRun, missingMonths, normalizeForecastProduct, seasonalitySummary, structuralBreakDiagnostics, walkForwardStability, type ForecastSourceRow } from "../lib/forecasting/readiness";

const database = process.argv[2] ?? ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/25b8c09731e6730e7346a57bf0354f6ad5ba2f35e7efd12ab95fbb1bbe08d08a.sqlite";
if (!existsSync(database)) throw new Error(`Local D1 database not found: ${database}`);
const query = "select sale_date as date, quantity, cast(sale_amount as real) as salesValue, cast(gp1 as real) as gp, product_type as product, branch from sales_transactions order by sale_date";
const rows = JSON.parse(execFileSync("sqlite3", [database, "-json", query], { encoding: "utf8" })) as ForecastSourceRow[];
const asOf = process.env.FORECAST_AS_OF ?? "2026-08-09";
const products = ["TT", "CH", "EX", "TP"];
const branches = ["KMM01", "KMM02", "KMM03"];

const companyCalendar = buildMonthlyActuals(rows, asOf);

function scopeReport(name: string, filter: (row: ForecastSourceRow) => boolean, alignToCompanyCalendar = true) {
  const scoped = buildMonthlyActuals(rows, asOf, filter);
  // A product or branch with no sale in a month is a real zero for that scope,
  // not a missing observation. The company calendar remains the sole source of
  // coverage gaps, so it is never silently filled.
  const byMonth = new Map(scoped.map((row) => [row.month, row]));
  const all = alignToCompanyCalendar
    ? companyCalendar.map((month) => byMonth.get(month.month) ?? {
      month: month.month,
      salesUnits: 0,
      salesValue: 0,
      gp: 0,
      gpPercent: null,
      rowCount: 0,
    })
    : scoped;
  const contiguous = longestContiguousRun(all);
  const values = contiguous.map((row) => row.salesUnits);
  const backtests = compareBaselines(values);
  const oneMonth = backtests[1].best?.metrics ?? null;
  const bestMethod = backtests[1].best?.method;
  const stability = bestMethod ? walkForwardStability(values, bestMethod) : null;
  const structuralBreak = structuralBreakDiagnostics(values);
  const recent24Best = values.length >= 24 ? compareBaselines(values.slice(-24), [1])[1].best : null;
  const windows = Object.fromEntries([12, 18, 24, values.length].filter((size, index, array) => size <= values.length && array.indexOf(size) === index).map((size) => {
    const window = values.slice(-size); const best = compareBaselines(window, [1])[1].best;
    return [size === values.length ? "full" : `recent${size}`, best ? { method: best.method, ...best.metrics, stability: walkForwardStability(window, best.method) } : null];
  }));
  return {
    scope: name,
    observedMonths: all.length,
    contiguousMonths: contiguous.length,
    coverageStart: contiguous[0]?.month ?? null,
    coverageEnd: contiguous.at(-1)?.month ?? null,
    missingMonths: missingMonths(all.map((row) => row.month)),
    zeroSalesMonths: all.filter((row) => row.salesUnits === 0).map((row) => row.month),
    bestBaseline: Object.fromEntries(Object.entries(backtests).map(([horizon, result]) => [horizon, result.best ? { method: result.best.method, ...result.best.metrics } : null])),
    stability,
    regimeWindows: windows,
    structuralBreak,
    // The isolated pre-2023 period is reported as a structural break. Readiness
    // is assessed only on the selected contiguous training run, never by
    // silently imputing its missing months.
    readiness: classifyReadiness({ completedMonths: contiguous.length, nonZeroMonths: values.filter((value) => value > 0).length, missingRatio: contiguous.length ? missingMonths(contiguous.map((row) => row.month)).length / contiguous.length : 1, metrics: oneMonth, recentMetrics: recent24Best?.metrics ?? null, stability, possibleRegimeChange: structuralBreak.possibleRegimeChange }),
    seasonality: seasonalitySummary(contiguous),
    outliers: detectOutliers(contiguous),
  };
}

const company = scopeReport("KMM company total", () => true, false);
const monthlyCompleteness = companyCalendar.filter((row) => row.month >= "2023-01").map((monthly) => {
  const monthRows = rows.filter((row) => row.date.startsWith(monthly.month));
  return { month: monthly.month, transactions: monthRows.length, engineUnits: monthly.salesUnits, branches: [...new Set(monthRows.map((row) => row.branch))].sort(), products: [...new Set(monthRows.map((row) => normalizeForecastProduct(row.product)))].sort(), earliestDay: monthRows[0]?.date ?? null, latestDay: monthRows.at(-1)?.date ?? null };
});
const report = {
  datasetVersion: "sales_transactions/local-d1/phase-4c-v1",
  asOf,
  source: "canonical sales_transactions; completed months only; Targets excluded",
  raw: { earliestDate: rows[0]?.date ?? null, latestDate: rows.at(-1)?.date ?? null, rowCount: rows.length },
  company,
  monthlyCompleteness,
  products: products.map((product) => scopeReport(product, (row) => normalizeForecastProduct(row.product) === product)),
  branches: branches.map((branch) => scopeReport(branch, (row) => row.branch === branch)),
  recoveryCandidates: [
    { source: "../01_Data/Sales/2607_KMM_CPI.xlsx", coverage: "2026 current CPI workbook", status: "not a 2022 recovery source" },
    { source: "../01_Data/Sales/2026_KMM_CPI copy.xlsx", coverage: "2026 current CPI copy", status: "not a 2022 recovery source" },
    { source: "public/dashboard-data.json", coverage: "legacy fallback/demo payload", status: "not authoritative for D1 recovery" },
  ],
  structuralBreakCandidates: [
    "2021-10 is an isolated observed month followed by a long gap before 2023-01; it is excluded from the longest contiguous backtest run.",
    "2026-04 through 2026-06 have materially lower monthly engine-unit volume than the prior observed run and should be reviewed as a possible operational or import-coverage break.",
  ],
  excluded: { partialCurrentMonth: "2026-08", targets: "Original H1 and Revised H2 Targets are not actual sales history", exogenousFeatures: "Booking and Stock are not included in Phase 4C baselines" },
};
console.log(JSON.stringify(report, null, 2));
