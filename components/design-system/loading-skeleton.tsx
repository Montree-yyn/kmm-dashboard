import { Skeleton } from "../ui/skeleton";

type LoadingSkeletonProps = { variant?: "kpi" | "chart" | "table" };

export function LoadingSkeleton({ variant = "chart" }: LoadingSkeletonProps) {
  if (variant === "kpi") return <Skeleton className="h-10 w-28" />;
  if (variant === "table") return <Skeleton className="h-44 w-full" />;
  return <Skeleton className="h-[260px] w-full" />;
}
