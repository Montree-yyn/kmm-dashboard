import { useId, type ReactNode } from "react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingSkeleton } from "./loading-skeleton";

type TableCardProps = {
  title: string;
  children: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  exportAction?: ReactNode;
  pagination?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  error?: string;
  onRetry?: () => void;
  retryLabel?: ReactNode;
  className?: string;
};

export function TableCard({
  title,
  children,
  search,
  filters,
  exportAction,
  pagination,
  loading = false,
  empty = false,
  error,
  onRetry,
  retryLabel,
  className,
}: TableCardProps) {
  const titleId = useId();
  const state = loading ? "loading" : error ? "error" : empty ? "empty" : "ready";

  return (
    <Card
      className={cn(
        "rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6",
        className,
      )}
      role="region"
      aria-labelledby={titleId}
      data-card-state={state}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 id={titleId} className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {search}
          {filters}
          {exportAction}
        </div>
      </div>
      <div className="mt-6">
        {loading ? (
          <LoadingSkeleton variant="table" />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} retryLabel={retryLabel} />
        ) : empty ? (
          <EmptyState />
        ) : (
          children
        )}
      </div>
      {pagination && <div className="mt-5">{pagination}</div>}
    </Card>
  );
}
