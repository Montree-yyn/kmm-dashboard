import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-[#FF8615] text-white shadow-[0_4px_14px_rgba(255,134,21,0.22)] hover:bg-[#E9760B]",
      outline: "border border-[#E0E2E5] bg-white text-[#55565A] hover:border-[#C9CCD1] hover:bg-[#F8FAFC]",
      ghost: "text-[#606168] hover:bg-[#F3F4F6] hover:text-[#1F2937]",
    },
    size: { default: "h-10 px-4", sm: "h-8 px-3 text-xs", lg: "h-11 px-5" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({ className, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
