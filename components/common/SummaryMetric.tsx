export type SummaryMetricProps = {
  label: string | number;
  value: string;
  unit: string;
  color: string;
};

/** A compact KPI value used in trend-chart comparison summaries. */
export function SummaryMetric({ label, value, unit, color }: SummaryMetricProps) {
  return (
    <div className="border-l border-[#E7EBF0] px-5 py-4">
      <p className="text-xs font-medium text-[#64748B]">{label}</p>
      <p className="mt-1 text-[25px] font-bold tracking-[-.03em]" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#475569]">{unit}</p>
    </div>
  );
}
