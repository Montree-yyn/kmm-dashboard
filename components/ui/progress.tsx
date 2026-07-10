import { cn } from "../../lib/utils";

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return <div className={cn("h-1.5 overflow-hidden rounded-full bg-[#EEF0F2]", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}><div className={cn("h-full rounded-full bg-[#FF8615] transition-[width] duration-500", indicatorClassName)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
