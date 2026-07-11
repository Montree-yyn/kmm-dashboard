"use client";

import { StandardLineChart, type StandardLineChartProps } from "./StandardLineChart";

/** The single project entry point for all premium trend charts. */
export function PremiumTrendChart(props: StandardLineChartProps) {
  return <StandardLineChart {...props} />;
}
