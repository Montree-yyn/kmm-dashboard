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
    <Card
      className={cn("kmm-glass-bar relative z-20 overflow-visible p-3", className)}
      role="region"
      aria-label={ariaLabel}
      data-filter-bar
      data-enterprise-component="filter-bar"
    >
      <div className="grid gap-2.5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className={cn("grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4", filterGridClassName)} role="group" aria-label={ariaLabel}>
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-start lg:justify-end">{actions}</div>}
      </div>
      {summary}
    </Card>
  );
}
