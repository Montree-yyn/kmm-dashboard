"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { useLocale } from "../../src/hooks/useLocale";

type NextValues = (option: string, current: string[]) => string[];

export type MultiSelectFilterProps = {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  /**
   * Presentation stays generic; pages can preserve an existing selection
   * contract (for example, the Sales "All Products" sentinel) here.
   */
  getNextValues?: NextValues;
  /** Values that represent the unfiltered state, such as `["All Products"]`. */
  allValues?: string[];
  allLabel?: string;
  className?: string;
};

function defaultNextValues(option: string, current: string[]) {
  return current.includes(option)
    ? current.filter((value) => value !== option)
    : [...current, option];
}

export function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
  getNextValues = defaultNextValues,
  allValues = [],
  allLabel,
  className,
}: MultiSelectFilterProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlId = useId();
  const listboxId = `${controlId}-options`;
  const allSelected = values.length === allValues.length
    && allValues.every((value) => values.includes(value));
  const visibleOptions = options.filter((option) => !allValues.includes(option));
  const resolvedAllLabel = allLabel ?? t("common.all");
  const displayValue = allSelected
    ? resolvedAllLabel
    : values.length === 1
      ? values[0]
      : `${values.length} ${t("common.selectedCount")}`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)} onKeyDown={(event) => {
      if (event.key === "Escape") setOpen(false);
    }}>
      <label htmlFor={controlId} className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <button
        id={controlId}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control-lg)] px-3 text-left text-sm font-medium text-[var(--text-primary)] transition-[border-color,box-shadow,background-color] duration-200 hover:border-[var(--text-disabled)] hover:bg-white focus-visible:border-[var(--brand-500)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none kmm-glass-control"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={`${t("common.filters")}: ${label}`}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      {open && (
        <Card
          className="absolute left-0 right-0 top-[70px] z-[80] overflow-hidden rounded-[var(--radius-control-lg)] border-[var(--border-default)] bg-[var(--surface-default)] p-1.5 shadow-[var(--shadow-floating)]"
          role="listbox"
          aria-multiselectable="true"
          aria-label={`${label}: ${t("common.all")}`}
          id={listboxId}
        >
          <label
            role="option"
            aria-selected={allSelected}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--brand-50)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]"
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                onChange(allValues);
                setOpen(false);
              }}
              className="peer sr-only"
            />
            <span className={cn(
              "grid size-5 shrink-0 place-items-center rounded-md border border-[var(--border-default)] text-transparent",
              allSelected && "border-[var(--brand-500)] bg-[var(--brand-500)] text-white",
            )}>
              <Check size={14} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="truncate">{resolvedAllLabel}</span>
          </label>
          {visibleOptions.length > 0 && <div className="mx-2 my-1 h-px bg-[var(--divider)]" />}
          <div className="max-h-60 space-y-0.5 overflow-y-auto overscroll-contain">
            {visibleOptions.map((option) => (
              <label
                key={option}
                role="option"
                aria-selected={values.includes(option)}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--brand-50)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] motion-reduce:transition-none"
              >
                <input
                  type="checkbox"
                  checked={values.includes(option)}
                  onChange={() => onChange(getNextValues(option, values))}
                  className="size-4 rounded border-[var(--border-default)] accent-[var(--brand-500)]"
                />
                <span className="truncate">{option}</span>
              </label>
            ))}
            {visibleOptions.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-[var(--text-tertiary)]">{t("common.noOptions")}</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export type ActiveFilterSummaryProps<Key extends string> = {
  filters: Record<Key, string[]>;
  labels: Record<Key, string>;
  onChange: (key: Key, values: string[]) => void;
  onReset: () => void;
  /** Values that are part of a page's unfiltered sentinel and should not be shown. */
  excludeValues?: Partial<Record<Key, string[]>>;
  /** Values to restore when an individual filter chip is removed. */
  clearValues?: Partial<Record<Key, string[]>>;
  className?: string;
};

export function ActiveFilterSummary<Key extends string>({
  filters,
  labels,
  onChange,
  onReset,
  excludeValues,
  clearValues,
  className,
}: ActiveFilterSummaryProps<Key>) {
  const { t } = useLocale();
  const active = (Object.entries(filters) as Array<[Key, string[]]>)
    .map(([key, values]) => {
      const excluded = excludeValues?.[key] ?? [];
      return [key, values.filter((value) => !excluded.includes(value))] as const;
    })
    .filter(([, values]) => values.length > 0);
  if (!active.length) return null;
  const activeSelectionCount = active.reduce((total, [, values]) => total + values.length, 0);

  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-2", className)} aria-label={t("common.activeFilters")}>
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{t("common.activeFilters")} · {activeSelectionCount}</span>
      {active.map(([key, values]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key, clearValues?.[key] ?? [])}
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--brand-400)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none"
          aria-label={`Remove ${labels[key]} filter`}
        >
          {labels[key]}: {values.length > 2 ? `${values.length} ${t("common.selectedCount")}` : values.join(", ")}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="min-h-11 rounded-full px-3 text-xs font-semibold text-[var(--brand-700)] transition-colors hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        {t("common.clearAll")}
      </button>
    </div>
  );
}

export type FilterBarActionsProps = { children: ReactNode };
