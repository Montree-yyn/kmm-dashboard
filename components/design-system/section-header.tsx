import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end" data-enterprise-component="section-header">
      <div>
        <h2 className="text-lg font-semibold leading-tight tracking-[-0.01em] text-[var(--text-primary)]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
