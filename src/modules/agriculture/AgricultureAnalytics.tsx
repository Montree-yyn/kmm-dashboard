"use client";

import { ChartCard, DataEmptyState, DonutChart, RankingBars, TrendLineChart, formatCropYear, formatNumber } from "./agriculture.data-charts";
import { agricultureCropName } from "./agriculture.ui";
import type { AgricultureDataView } from "./agriculture.data-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["dataView"];
type Language = import("../../../src/locales").Language;

export function AgricultureAnalytics({ view, copy, language }: { view: AgricultureDataView; copy: Copy; language: Language }) {
  const donut = view.donut;
  return (
    <section className="grid gap-5 xl:grid-cols-3" data-agri-analytics>
      <ChartCard
        title={copy.donutTitle}
        subtitle={copy.donutSub.replace("{unit}", view.summary.areaUnit ?? "")}
        empty={donut ? undefined : <DataEmptyState title={copy.donutNoData} message={copy.donutNoDataHelp} />}
      >
        {donut && (
          <DonutChart
            donut={donut}
            centerLabel={copy.donutTotalLabel}
            centerValue={donut.moreThan ? `>${formatNumber(donut.total)}` : formatNumber(donut.total)}
            centerUnit={view.summary.areaUnit}
            segmentName={(segment) => agricultureCropName(null, segment.cropCode, language)}
          />
        )}
      </ChartCard>
      <ChartCard
        title={copy.rankingTitle}
        subtitle={copy.rankingSub}
        empty={view.ranking.length ? undefined : <DataEmptyState title={copy.rankingNoData} />}
      >
        {view.ranking.length > 0 && <RankingBars points={view.ranking} unit={view.summary.areaUnit} />}
      </ChartCard>
      <ChartCard
        title={copy.trendTitle}
        subtitle={view.trendYears > 0 ? copy.trendSub.replace("{unit}", view.trendUnit ?? "") : undefined}
        empty={
          view.trend.length === 0
            ? <DataEmptyState title={copy.trendNoData} />
            : view.trend.length === 1
              ? <DataEmptyState title={copy.trendSingleYear.replace("{year}", formatCropYear(view.trend[0].year))} />
              : undefined
        }
      >
        {view.trend.length > 1 && <TrendLineChart points={view.trend} />}
      </ChartCard>
    </section>
  );
}
