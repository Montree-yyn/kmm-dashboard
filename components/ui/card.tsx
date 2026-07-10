import * as React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_14px_rgba(31,41,55,0.045)]", className)} {...props} />;
}
