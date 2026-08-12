"use client";

import { ChevronDown, Globe2, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";
import { KaiHeaderAssistant } from "../kai/kai-header-assistant";
import { CompanySwitcher } from "../company/company-switcher";
import { GlobalNavigationSearch } from "../navigation/global-navigation-search";
import { useLocale } from "../../src/hooks/useLocale";
import { useCompany } from "../../src/hooks/useCompany";
import { companyRoleLabel } from "../../lib/company-context/types";
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
  const { selectedCompany } = useCompany();
  const route =
    routeTitles.find(
      (item) =>
        pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
    ) ?? routeTitles[1];

  return (
    <header
      className="sticky top-0 z-30 flex h-[72px] items-center bg-transparent px-2 sm:px-3 xl:px-4"
      data-global-header
    >
      <div className="kmm-glass-bar flex h-14 w-full min-w-0 items-center gap-2 px-2 sm:px-3">
        <button
          type="button"
          className="kmm-glass-control grid size-11 shrink-0 place-items-center rounded-[var(--radius-control-lg)] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden"
          onClick={onOpenNavigation}
          aria-label={t("common.openNavigation")}
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <div className="hidden min-w-0 min-[560px]:block xl:hidden">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {t(route.title)}
          </p>
          <p className="hidden truncate text-[11px] text-[var(--text-tertiary)] sm:block">
            {selectedCompany
              ? t(route.subtitle).replaceAll("KMM", selectedCompany.code)
              : t(route.subtitle)}
          </p>
        </div>

        <GlobalNavigationSearch key={selectedCompany?.id ?? "company"} />

        <div id="kmm-global-header-slot" className="hidden min-w-0 flex-1 items-center justify-end" />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CompanySwitcher />
          <label className="kmm-glass-control relative grid size-11 place-items-center rounded-[var(--radius-control-lg)] text-[var(--text-secondary)] xl:hidden">
            <Globe2 size={17} aria-hidden="true" />
            <span className="sr-only">{t("language.select")}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as "th" | "en" | "my")} aria-label={t("language.select")} className="absolute inset-0 cursor-pointer opacity-0">
              <option value="th">{t("language.thai")}</option>
              <option value="en">{t("language.english")}</option>
              <option value="my">{t("language.myanmar")}</option>
            </select>
          </label>
          <label className="relative hidden h-10 items-center xl:flex">
            <Globe2 className="pointer-events-none absolute left-3 z-10 text-[var(--text-tertiary)]" size={15} aria-hidden="true" />
            <span className="sr-only">{t("language.select")}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as "th" | "en" | "my")}
              aria-label={t("language.select")}
              className="kmm-glass-control h-10 min-w-[112px] appearance-none rounded-[var(--radius-control)] pl-9 pr-8 text-xs font-semibold text-[var(--text-secondary)] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <option value="th">{t("language.thai")}</option>
              <option value="en">{t("language.english")}</option>
              <option value="my">{t("language.myanmar")}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 text-[var(--text-tertiary)]" size={14} aria-hidden="true" />
          </label>
          <span className="hidden md:block"><HeaderPresentationTrigger /></span>
          <KaiHeaderAssistant key={selectedCompany?.id ?? "company"} className="kmm-glass-control" />
          <div
            className="kmm-glass-control hidden min-h-11 items-center gap-2 rounded-[var(--radius-control-lg)] p-1 pr-2 text-[var(--text-primary)] sm:flex"
            aria-label={selectedCompany ? `${selectedCompany.code} ${companyRoleLabel(selectedCompany.role)}` : "Company member"}
          >
            <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-[var(--text-primary)] text-xs font-bold text-white">
              {selectedCompany?.code.slice(0, 3) ?? "KM"}
            </span>
            <span className="hidden text-left min-[1500px]:block">
              <span className="block max-w-32 truncate text-xs font-semibold">{selectedCompany ? `${selectedCompany.code} ${companyRoleLabel(selectedCompany.role)}` : "Company member"}</span>
              <span className="block text-[10px] text-[var(--text-tertiary)]">Single-company view</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
