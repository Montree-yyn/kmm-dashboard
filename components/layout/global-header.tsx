"use client";

import { Bell, ChevronDown, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";
import { KaiHeaderAssistant } from "../kai/kai-header-assistant";
import { cn } from "../../lib/utils";
import { useLocale } from "../../src/hooks/useLocale";

const routeTitles: Array<{
  prefix: string;
  title: string;
  subtitle: string;
}> = [
  {
    prefix: "/settings/company",
    title: "Company Management",
    subtitle: "Enterprise configuration",
  },
  {
    prefix: "/dashboard",
    title: "Dashboard",
    subtitle: "KMM Executive Intelligence",
  },
  {
    prefix: "/sales",
    title: "Sales Performance",
    subtitle: "KMM Sales Intelligence",
  },
  {
    prefix: "/booking",
    title: "Booking Intelligence",
    subtitle: "KMM Booking Intelligence",
  },
  {
    prefix: "/stock",
    title: "Stock Intelligence",
    subtitle: "KMM Inventory Intelligence",
  },
  {
    prefix: "/marketing",
    title: "Marketing Intelligence",
    subtitle: "KMM Geospatial Intelligence",
  },
  {
    prefix: "/settings",
    title: "Settings",
    subtitle: "Enterprise Control Center",
  },
  {
    prefix: "/expense",
    title: "Expense Intelligence",
    subtitle: "KMM Financial Intelligence",
  },
  {
    prefix: "/team",
    title: "Sales Organization",
    subtitle: "KMM Organization Intelligence",
  },
];

type GlobalHeaderProps = {
  onOpenNavigation: () => void;
};

export function GlobalHeader({ onOpenNavigation }: GlobalHeaderProps) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLocale();
  const route =
    routeTitles.find(
      (item) =>
        pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
    ) ?? routeTitles[1];

  return (
    <header
      className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 backdrop-blur-xl sm:px-6 xl:px-8"
      data-global-header
    >
      <button
        type="button"
        className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control-lg)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden"
        onClick={onOpenNavigation}
        aria-label="Open navigation"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-[var(--text-primary)]">
          {route.title}
        </p>
        <p className="hidden truncate text-xs text-[var(--text-tertiary)] sm:block">
          {route.subtitle}
        </p>
      </div>

      <div
        id="kmm-global-header-slot"
        className="ml-auto hidden min-w-0 flex-1 items-center justify-end md:flex"
      />

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 md:ml-0">
        <div className="hidden h-10 items-center rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] p-0.5 text-xs font-semibold sm:inline-flex">
          <button
            type="button"
            onClick={() => setLanguage("th")}
            className={cn(
              "grid h-8 min-w-9 place-items-center rounded-lg px-2 transition-colors duration-150",
              language === "th"
                ? "bg-[var(--brand-100)] text-[var(--brand-600)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
            )}
            aria-pressed={language === "th"}
          >
            {t("language.thai")}
          </button>
          <span className="text-[var(--border-default)]">|</span>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={cn(
              "grid h-8 min-w-9 place-items-center rounded-lg px-2 transition-colors duration-150",
              language === "en"
                ? "bg-[var(--brand-100)] text-[var(--brand-600)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
            )}
            aria-pressed={language === "en"}
          >
            {t("language.english")}
          </button>
        </div>
        <HeaderPresentationTrigger />
        <button
          type="button"
          className="relative hidden size-11 place-items-center rounded-[var(--radius-control-lg)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:grid"
          aria-label="Open notifications"
        >
          <Bell size={18} aria-hidden="true" />
          <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[var(--status-danger)]" />
        </button>
        <KaiHeaderAssistant />
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control-lg)] p-1.5 pr-2 text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-label="Open profile menu"
        >
          <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-[var(--text-primary)] text-xs font-bold text-white">
            KM
          </span>
          <span className="hidden text-left xl:block">
            <span className="block text-xs font-semibold">KMM Admin</span>
            <span className="block text-[10px] text-[var(--text-tertiary)]">
              Executive view
            </span>
          </span>
          <ChevronDown
            className="hidden text-[var(--text-tertiary)] xl:block"
            size={15}
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  );
}
