import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[#1F2937]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#6B7280]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
