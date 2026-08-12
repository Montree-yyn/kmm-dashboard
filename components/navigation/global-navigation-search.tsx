"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "../../src/hooks/useCompany";
import { useLocale } from "../../src/hooks/useLocale";
import { cn } from "../../lib/utils";
import { visibleNavigationItems } from "./navigation-config";

export function GlobalNavigationSearch() {
  const router = useRouter();
  const { t } = useLocale();
  const { selectedCompany } = useCompany();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const available = visibleNavigationItems.filter((item) => {
      if (item.href === "/marketing") return selectedCompany?.capabilities.marketing !== false;
      if (item.href === "/expense") return selectedCompany?.capabilities.expense !== false;
      return true;
    });
    if (!normalized) return available.slice(0, 6);
    return available.filter((item) => {
      const localized = t(item.labelKey ?? "nav.dashboard");
      return `${item.label} ${localized} ${item.href}`.toLocaleLowerCase().includes(normalized);
    });
  }, [query, selectedCompany, t]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
      }
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyboard);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative hidden w-full max-w-[520px] min-w-0 flex-none xl:block">
      <div className="kmm-glass-control flex h-11 items-center rounded-[var(--radius-control-lg)] px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--brand-300)] focus-within:ring-2 focus-within:ring-[var(--brand-focus)]">
        <Search className="shrink-0 text-[var(--text-tertiary)]" size={17} aria-hidden="true" />
        <label htmlFor="global-navigation-search" className="sr-only">{t("common.searchNavigation")}</label>
        <input
          ref={inputRef}
          id="global-navigation-search"
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => results.length ? (current + 1) % results.length : -1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => results.length ? (current <= 0 ? results.length - 1 : current - 1) : -1);
            } else if (event.key === "Enter" && open && activeIndex >= 0 && results[activeIndex]) {
              event.preventDefault();
              router.push(results[activeIndex].href);
              setOpen(false);
              setQuery("");
              setActiveIndex(-1);
            } else if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          placeholder={t("common.searchNavigation")}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="global-navigation-results"
          aria-activedescendant={open && activeIndex >= 0 ? `global-navigation-option-${activeIndex}` : undefined}
        />
        {query ? (
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            onClick={() => { setQuery(""); setActiveIndex(-1); inputRef.current?.focus(); }}
            aria-label={t("common.clearSearch")}
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : (
          <kbd className="rounded-md border border-[var(--border-default)] bg-white/70 px-2 py-1 text-[10px] font-semibold text-[var(--text-tertiary)]">/</kbd>
        )}
      </div>

      {open && (
        <div id="global-navigation-results" className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[420px] overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--border-default)] bg-[var(--surface-default)] p-2 shadow-[var(--shadow-floating)]" role="listbox" aria-label={t("common.navigationResults")}>
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            {query ? t("common.navigationResults") : t("common.quickNavigation")}
          </p>
          {results.length ? results.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                id={`global-navigation-option-${index}`}
                href={item.href}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => { setOpen(false); setQuery(""); setActiveIndex(-1); }}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-[var(--radius-control-lg)] px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/80 hover:text-[var(--text-primary)]",
                  index === activeIndex && "bg-white/80 text-[var(--text-primary)]",
                )}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{t(item.labelKey ?? "nav.dashboard")}</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">{item.href}</span>
              </Link>
            );
          }) : (
            <p className="px-3 py-5 text-center text-sm text-[var(--text-secondary)]">{t("common.noNavigationResults")}</p>
          )}
        </div>
      )}
    </div>
  );
}
