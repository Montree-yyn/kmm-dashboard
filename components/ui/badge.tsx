import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold", {
  variants: {
    variant: {
      default: "bg-[#FFF1E3] text-[#D96500]",
      outline: "border border-[#E5E7EB] bg-white text-[#606168]",
      success: "bg-[#ECFDF3] text-[#15803D]",
      warning: "bg-[#FFF7E6] text-[#B45309]",
      danger: "bg-[#FEF2F2] text-[#DC2626]",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
