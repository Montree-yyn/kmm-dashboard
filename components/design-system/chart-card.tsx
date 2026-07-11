import type { ReactNode } from "react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingSkeleton } from "./loading-skeleton";

type ChartCardProps = {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  error?: string;
  minHeight?: number;
  className?: string;
};

export function ChartCard({ title, subtitle, legend, action, children, loading = false, empty = false, error, minHeight, className }: ChartCardProps) {
  return (
    <Card className={cn("rounded-2xl border-[#E8EAED] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)] sm:p-6", className)} style={minHeight ? { minHeight } : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[#1F2937]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {legend && <div className="mt-5">{legend}</div>}
      <div className="mt-7">
        {loading ? <LoadingSkeleton variant="chart" /> : error ? <ErrorState message={error} /> : empty ? <EmptyState /> : children}
      </div>
    </Card>
  );
}
