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
  loading?: boolean;
  empty?: boolean;
  className?: string;
};

const comparisonTone: Record<ComparisonDirection, string> = {
  positive: "text-[#16A34A]",
  negative: "text-[#DC2626]",
  neutral: "text-[#6B7280]",
};

export function KpiCard({ title, value, unit, comparison, supportingText, loading = false, empty = false, className }: KpiCardProps) {
  return (
    <Card className={cn("h-full min-h-[168px] rounded-2xl border-[#E8EAED] bg-white p-4 shadow-[0_8px_24px_rgba(31,41,55,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(31,41,55,0.07)] 2xl:p-5", className)}>
      <div className="flex h-full min-h-[136px] flex-col">
        <div className="min-h-10">
          <p className="max-h-10 overflow-hidden text-[15px] font-semibold leading-5 text-[#4B5563]">{title}</p>
        </div>

        <div className="flex min-h-12 flex-1 items-center">
          {loading ? (
            <div className="h-10 w-28 animate-pulse rounded-lg bg-[#E9EBEE]" aria-label={`Loading ${title}`} />
          ) : empty ? (
            <strong className="text-[20px] font-semibold leading-none text-[#9CA3AF]">No data available</strong>
          ) : (
            <div className="flex min-w-0 items-baseline gap-2">
              <strong className="shrink-0 text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#1F2937]">{value}</strong>
              {unit && <span className="whitespace-nowrap text-sm font-semibold leading-none text-[#6B7280]">{unit}</span>}
            </div>
          )}
        </div>

        <div className="min-h-11 text-xs font-medium leading-4 text-[#9CA3AF]">
          {comparison ? (
            <>
              <p className={cn("text-sm font-bold leading-4", comparisonTone[comparison.direction])}>{comparison.value}</p>
              <p className="mt-1 line-clamp-2">{comparison.label}</p>
            </>
          ) : supportingText ? (
            <div className="line-clamp-2 pt-0.5">{supportingText}</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
