import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-4", {
  variants: {
    variant: {
      default: "bg-[var(--brand-100)] text-[var(--brand-700)]",
      outline: "border border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-secondary)]",
      success: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
      warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
      danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
