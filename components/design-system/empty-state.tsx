"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useLocale } from "../../src/hooks/useLocale";

type EmptyStateProps = {
  title?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, message, action, className }: EmptyStateProps) {
  const { t } = useLocale();
  return (
    <div
      className={cn("grid min-h-32 place-items-center px-4 py-6 text-center text-sm text-[var(--text-secondary)]", className)}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md">
        {title && <p className="font-semibold text-[var(--text-primary)]">{title}</p>}
        <p className={cn("font-medium", title && "mt-1")}>{message ?? t("common.empty")}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
