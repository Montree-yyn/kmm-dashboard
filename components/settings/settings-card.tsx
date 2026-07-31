import type { LucideIcon } from "lucide-react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export type SettingsCardDefinition = {
  id: string;
  title: string;
  description: readonly string[];
  icon: LucideIcon;
};

type SettingsCardProps = {
  item: SettingsCardDefinition;
  selected: boolean;
  onSelect: (item: SettingsCardDefinition) => void;
};

export function SettingsCard({
  item,
  selected,
  onSelect,
}: SettingsCardProps) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className={cn(
        "group flex min-h-[250px] min-w-0 flex-col rounded-[var(--radius-card)] border bg-[var(--surface-default)] p-5 text-left shadow-[var(--shadow-card)] transition-[transform,border-color,box-shadow] duration-150 motion-reduce:transform-none motion-reduce:transition-none",
        "hover:-translate-y-1 hover:scale-[1.01] hover:border-[var(--text-disabled)] hover:shadow-[var(--shadow-hover)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        selected
          ? "border-[var(--brand-500)]"
          : "border-[var(--border-default)]",
      )}
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      aria-label={`Open ${item.title}`}
      data-settings-card={item.id}
    >
      <span
        className={cn(
          "grid size-14 place-items-center rounded-[var(--radius-control-lg)] transition-colors duration-150",
          selected
            ? "bg-[var(--brand-100)] text-[var(--brand-600)]"
            : "bg-[var(--surface-subtle)] text-[var(--text-secondary)] group-hover:bg-[var(--brand-50)] group-hover:text-[var(--brand-600)]",
        )}
        aria-hidden="true"
      >
        <Icon size={27} strokeWidth={1.8} />
      </span>

      <h2 className="mt-5 text-base font-semibold leading-6 text-[var(--text-primary)]">
        {item.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {item.description.join(" · ")}
      </p>

      <span className="mt-auto flex w-full items-center justify-between gap-3 pt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--status-success)_10%,white)] px-2.5 py-1 text-[11px] font-semibold text-[var(--status-success)]">
          <Check size={12} aria-hidden="true" />
          Active
        </span>
        <ChevronRight
          size={18}
          className="text-[var(--text-tertiary)] transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}
