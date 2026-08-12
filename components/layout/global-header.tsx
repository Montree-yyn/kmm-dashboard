"use client";

import { Bell, ChevronDown, Globe2, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";
import { KaiHeaderAssistant } from "../kai/kai-header-assistant";
import { useLocale } from "../../src/hooks/useLocale";
import type { LocaleKey } from "../../src/locales";

const routeTitles: Array<{
  prefix: string;
  title: LocaleKey;
  subtitle: LocaleKey;
}> = [
  {
    prefix: "/settings/company",
    title: "route.companyManagement.title",
    subtitle: "route.companyManagement.subtitle",
  },
  {
    prefix: "/dashboard",
    title: "route.dashboard.title",
    subtitle: "route.dashboard.subtitle",
  },
  {
    prefix: "/daily-management",
    title: "route.dailyManagement.title",
    subtitle: "route.dailyManagement.subtitle",
  },
  {
    prefix: "/sales",
    title: "route.sales.title",
    subtitle: "route.sales.subtitle",
  },
  {
    prefix: "/booking",
    title: "route.booking.title",
    subtitle: "route.booking.subtitle",
  },
  {
    prefix: "/stock",
    title: "route.stock.title",
    subtitle: "route.stock.subtitle",
  },
  {
    prefix: "/marketing",
    title: "route.marketing.title",
    subtitle: "route.marketing.subtitle",
  },
  {
    prefix: "/weather",
    title: "route.weather.title",
    subtitle: "route.weather.subtitle",
  },
  {
    prefix: "/data-hub",
    title: "route.dataHub.title",
    subtitle: "route.dataHub.subtitle",
  },
  {
    prefix: "/settings",
    title: "route.settings.title",
    subtitle: "route.settings.subtitle",
  },
  {
    prefix: "/expense",
    title: "route.expense.title",
    subtitle: "route.expense.subtitle",
  },
  {
    prefix: "/team",
    title: "route.team.title",
    subtitle: "route.team.subtitle",
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
        aria-label={t("common.openNavigation")}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-[var(--text-primary)]">
          {t(route.title)}
        </p>
        <p className="hidden truncate text-xs text-[var(--text-tertiary)] sm:block">
          {t(route.subtitle)}
        </p>
      </div>

      <div
        id="kmm-global-header-slot"
        className="ml-auto hidden min-w-0 flex-1 items-center justify-end md:flex"
      />

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 md:ml-0">
        <label className="relative grid size-11 place-items-center rounded-[var(--radius-control-lg)] border border-[var(--border-default)] text-[var(--text-secondary)] sm:hidden">
          <Globe2 size={17} aria-hidden="true" />
          <span className="sr-only">{t("language.select")}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as "th" | "en" | "my")} aria-label={t("language.select")} className="absolute inset-0 cursor-pointer opacity-0">
            <option value="th">{t("language.thai")}</option>
            <option value="en">{t("language.english")}</option>
            <option value="my">{t("language.myanmar")}</option>
          </select>
        </label>
        <label className="relative hidden h-10 items-center sm:flex">
          <Globe2 className="pointer-events-none absolute left-3 z-10 text-[var(--text-tertiary)]" size={15} aria-hidden="true" />
          <span className="sr-only">{t("language.select")}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as "th" | "en" | "my")}
            aria-label={t("language.select")}
            className="h-10 min-w-[118px] appearance-none rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] pl-9 pr-8 text-xs font-semibold text-[var(--text-secondary)] outline-none transition hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <option value="th">{t("language.thai")}</option>
            <option value="en">{t("language.english")}</option>
            <option value="my">{t("language.myanmar")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 text-[var(--text-tertiary)]" size={14} aria-hidden="true" />
        </label>
        <HeaderPresentationTrigger />
        <button
          type="button"
          className="relative hidden size-11 place-items-center rounded-[var(--radius-control-lg)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:grid"
          aria-label={t("common.openNotifications")}
        >
          <Bell size={18} aria-hidden="true" />
          <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[var(--status-danger)]" />
        </button>
        <KaiHeaderAssistant />
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control-lg)] p-1.5 pr-2 text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-label={t("common.openProfileMenu")}
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
