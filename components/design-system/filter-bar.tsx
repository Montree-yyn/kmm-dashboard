import type { ReactNode } from "react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

type FilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  filterGridClassName?: string;
  className?: string;
  ariaLabel?: string;
};

export function FilterBar({
  children,
  actions,
  summary,
  filterGridClassName,
  className,
  ariaLabel = "Filters",
}: FilterBarProps) {
  return (
    <Card className={cn("border-[var(--border-default)] p-4 shadow-[var(--shadow-card)] sm:p-5", className)}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", filterGridClassName)} role="group" aria-label={ariaLabel}>
          {children}
        </div>
        {actions && <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-start lg:justify-end">{actions}</div>}
      </div>
      {summary}
    </Card>
  );
}
