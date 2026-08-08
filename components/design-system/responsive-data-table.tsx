import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type ResponsiveDataTableProps = {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
};

/**
 * Presentation-only table viewport. The table, rows, sorting, pagination, and
 * export controls remain owned by the page so the first migration can prove
 * parity without introducing a second data-table implementation.
 */
export function ResponsiveDataTable({ children, ariaLabel, className }: ResponsiveDataTableProps) {
  return (
    <div
      className={cn("w-full overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2", className)}
      role="region"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
