import { Badge } from "../ui/badge";

export type ProductBadgeLabel = "TT" | "CH" | "EX" | "TP" | "MAX" | "IM" | "IMO" | "OT" | "Other";

type ProductBadgeProps = {
  label: ProductBadgeLabel;
  value?: number;
};

export function ProductBadge({ label, value }: ProductBadgeProps) {
  return (
    <Badge variant="outline" className="border-[#E5E7EB] bg-[#FAFBFC] px-2 py-0.5 text-[10px] font-semibold leading-5 text-[#606168]">
      {label}{typeof value === "number" ? ` ${value}` : ""}
    </Badge>
  );
}
