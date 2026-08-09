export const TARGET_METRICS = ["SALES_UNITS", "SALES_REVENUE", "GP1"] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];
export type TargetProductGroup = "" | "TT" | "CH" | "EX_TP";

export type ApprovedTarget = {
  year: number;
  month: number;
  metric: TargetMetric;
  target: number;
  productGroup: TargetProductGroup;
  source: string;
  sourceVersion: string;
  effectiveFrom: string;
};
