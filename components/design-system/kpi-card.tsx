import type { ReactNode } from "react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

type ComparisonDirection = "positive" | "negative" | "neutral";

type KpiCardProps = {
  title: string;
  value: ReactNode;
  unit: string;
  comparison?: {
    value: string;
    direction: ComparisonDirection;
    label: string;
  };
  supportingText?: ReactNode;
  productBreakdown?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  className?: string;
};

const comparisonTone: Record<ComparisonDirection, string> = {
  positive: "text-[#16A34A]",
  negative: "text-[#DC2626]",
  neutral: "text-[#6B7280]",
};

export function KpiCard({ title, value, unit, comparison, supportingText, productBreakdown, loading = false, empty = false, className }: KpiCardProps) {
  return (
    <Card className={cn("flex h-full min-h-[168px] flex-col justify-between rounded-2xl border-[#E8EAED] bg-white p-4 shadow-[0_8px_24px_rgba(31,41,55,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(31,41,55,0.07)] 2xl:p-5", className)}>
      <p className="text-[15px] font-semibold text-[#4B5563]">{title}</p>
      <div className="pt-6">
        {loading ? (
          <div className="h-10 w-28 animate-pulse rounded-lg bg-[#E9EBEE]" aria-label={`Loading ${title}`} />
        ) : empty ? (
          <p className="text-sm font-medium text-[#9CA3AF]">No data available</p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <strong className="text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#1F2937]">{value}</strong>
              <span className="pb-1 text-sm font-semibold text-[#6B7280]">{unit}</span>
            </div>
            {comparison && (
              <>
                <p className={cn("mt-4 text-sm font-bold", comparisonTone[comparison.direction])}>{comparison.value}</p>
                <p className="mt-1 text-xs font-medium text-[#9CA3AF]">{comparison.label}</p>
              </>
            )}
            {supportingText && <p className="mt-4 text-xs font-medium text-[#9CA3AF]">{supportingText}</p>}
            {productBreakdown}
          </>
        )}
      </div>
    </Card>
  );
}
