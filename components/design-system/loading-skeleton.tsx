import { Skeleton } from "../ui/skeleton";

type LoadingSkeletonProps = { variant?: "kpi" | "chart" | "table"; label?: string };

export function LoadingSkeleton({ variant = "chart", label = "Loading" }: LoadingSkeletonProps) {
  const skeleton = variant === "kpi"
    ? <Skeleton className="h-10 w-28" />
    : variant === "table"
      ? <Skeleton className="h-44 w-full" />
      : <Skeleton className="h-[260px] w-full" />;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      data-loading-variant={variant}
      data-enterprise-component="loading-state"
    >
      {skeleton}
    </div>
  );
}
