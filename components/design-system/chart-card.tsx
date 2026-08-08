import { useId, type ReactNode } from "react";
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
  toolbar?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  error?: string;
  minHeight?: number;
  className?: string;
};

export function ChartCard({ title, subtitle, legend, action, toolbar, children, loading = false, empty = false, error, minHeight, className }: ChartCardProps) {
  const titleId = useId();
  return (
    <Card className={cn("rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6", className)} style={minHeight ? { minHeight } : undefined} role="region" aria-labelledby={titleId}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[var(--text-primary)]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
        {(toolbar || action) && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{toolbar}{action}</div>}
      </header>
      {legend && <div className="mt-5" role="group" aria-label={`${title} legend`}>{legend}</div>}
      <div className="mt-7" aria-busy={loading || undefined}>
        {loading ? <LoadingSkeleton variant="chart" label={`Loading ${title}`} /> : error ? <ErrorState message={error} /> : empty ? <EmptyState /> : children}
      </div>
    </Card>
  );
}
