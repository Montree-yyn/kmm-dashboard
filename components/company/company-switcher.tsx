"use client";

import { Building2, Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { companyRoleLabel } from "../../lib/company-context/types";
import { useCompany } from "../../src/hooks/useCompany";
import { cn } from "../../lib/utils";

export function CompanySwitcher() {
  const { companies, selectedCompany, switchCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!selectedCompany) return null;
  const canSwitch = companies.length > 1;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "kmm-glass-control flex h-11 max-w-[220px] items-center gap-2 rounded-[var(--radius-control-lg)] px-2 text-left text-[var(--text-primary)] transition-colors sm:px-2.5",
          canSwitch && "hover:bg-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
          !canSwitch && "cursor-default",
        )}
        onClick={() => canSwitch && setOpen((current) => !current)}
        aria-label={`Current company: ${selectedCompany.name}${canSwitch ? ". Change company" : ""}`}
        aria-expanded={canSwitch ? open : undefined}
        aria-controls={canSwitch ? menuId : undefined}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-[var(--brand-50)] text-[var(--brand-700)]">
          <Building2 size={15} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold">{selectedCompany.code}</span>
          <span className="hidden truncate text-[10px] text-[var(--text-tertiary)] 2xl:block">{selectedCompany.name}</span>
        </span>
        {canSwitch && <ChevronDown className={cn("ml-auto shrink-0 text-[var(--text-tertiary)] transition-transform", open && "rotate-180")} size={14} aria-hidden="true" />}
      </button>

      {open && (
        <div
          id={menuId}
          className="kmm-glass-bar absolute right-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-24px))] overflow-hidden p-1.5"
          role="menu"
          aria-label="Choose company"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold text-[var(--text-tertiary)]">Choose one company</p>
          {companies.map((company) => {
            const active = company.id === selectedCompany.id;
            return (
              <button
                key={company.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control-lg)] px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  active ? "bg-[var(--brand-50)]" : "hover:bg-[var(--surface-subtle)]",
                )}
                onClick={() => {
                  switchCompany(company.id);
                  setOpen(false);
                }}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] text-xs font-bold", active ? "bg-[var(--brand-600)] text-white" : "bg-[var(--surface-muted)] text-[var(--text-secondary)]")}>{company.code.slice(0, 3)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{company.name}</span>
                  <span className="block truncate text-[11px] text-[var(--text-tertiary)]">{companyRoleLabel(company.role)} · {company.branchCount} branches</span>
                </span>
                {active && <Check className="shrink-0 text-[var(--brand-700)]" size={17} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
