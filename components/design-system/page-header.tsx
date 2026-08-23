import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end" data-enterprise-component="page-header">
      <div>
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-600)]">{eyebrow}</p>}
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-[30px]">{title}</h1>
        {description && <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
