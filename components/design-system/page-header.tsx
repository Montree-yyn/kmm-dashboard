import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div>
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E86F00]">{eyebrow}</p>}
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1F2937] sm:text-[30px]">{title}</h1>
        {description && <p className="mt-2 text-sm text-[#6B7280]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
