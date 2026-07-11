import type { ReactNode } from "react";
import { Badge } from "../ui/badge";

type Status = "positive" | "negative" | "warning" | "neutral" | "active" | "inactive";
type StatusBadgeProps = { status: Status; children: ReactNode; className?: string };

const statusVariant = {
  positive: "success",
  active: "success",
  negative: "danger",
  warning: "warning",
  neutral: "outline",
  inactive: "outline",
} as const;

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return <Badge variant={statusVariant[status]} className={className}>{children}</Badge>;
}
