import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[background-color,border-color,box-shadow,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-[var(--brand-500)] text-[var(--text-primary)] shadow-[0_4px_14px_rgb(245_102_0_/_22%)] hover:bg-[var(--brand-400)]",
      outline: "border border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-secondary)] hover:border-[var(--text-disabled)] hover:bg-[var(--surface-subtle)]",
      ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
    },
    size: { default: "px-4", sm: "px-3 text-xs", lg: "px-5" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({ className, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
