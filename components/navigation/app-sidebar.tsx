"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  LogOut,
  X,
  ChevronDown,
  Building2,
} from "lucide-react";
import { auth } from "../../lib/firebase";
import { cn } from "../../lib/utils";
import {
  navigationItemIsActive,
  visibleNavigationItems,
} from "./navigation-config";
import { useLocale } from "../../src/hooks/useLocale";

type AppSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onMobileOpenChange: (open: boolean) => void;
};

export function AppSidebar({ collapsed, mobileOpen, onCollapsedChange, onMobileOpenChange }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  async function logout() {
    await signOut(auth);
    router.replace("/login");
  }

  const renderSidebar = (isCollapsed: boolean) => (
    <>
      <div className="flex min-h-[88px] items-center justify-between border-b border-[var(--border-default)] px-4 py-6">
        <img src="/kmm-logo.png" alt="Kubota Maesod Myanmar" className={cn("h-11 w-auto object-contain object-left transition-all", isCollapsed ? "max-w-10 object-[9%_center]" : "max-w-[128px]")} />
        <button className="hidden rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F4F5F7] hover:text-[#55565A] lg:block" onClick={() => onCollapsedChange(!collapsed)} aria-label={collapsed ? t("nav.expand") : t("nav.collapse")} title={collapsed ? t("nav.expand") : t("nav.collapse")}>
          <ChevronDown className={cn("rotate-90 transition-transform", collapsed && "-rotate-90")} size={18} />
        </button>
        <button className="rounded-lg p-2 text-[#55565A] hover:bg-[#F4F5F7] lg:hidden" onClick={() => onMobileOpenChange(false)} aria-label={t("nav.close")}><X size={20} /></button>
      </div>
      <nav
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-6"
        aria-label={t("nav.primary")}
      >
        {visibleNavigationItems.map((item) => {
          const Icon = item.icon;
          const active = navigationItemIsActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onMobileOpenChange(false)}
              className={cn(
                "group flex h-12 w-full shrink-0 items-center gap-4 rounded-[14px] pl-5 pr-4 text-base font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                active
                  ? "bg-[var(--brand-100)] text-[var(--brand-600)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]",
                isCollapsed && "justify-center px-0",
              )}
              title={isCollapsed ? t(item.labelKey ?? "nav.dashboard") : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className="size-[22px] shrink-0"
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden="true"
              />
              {!isCollapsed && <span className="min-w-0 break-words leading-tight">{t(item.labelKey ?? "nav.dashboard")}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border-default)] p-4">
        {!isCollapsed && (
          <div className="mb-2 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-[var(--brand-50)] text-[var(--brand-600)]">
                <Building2 size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
                  KMM Company
                </span>
                <span className="block text-[11px] text-[var(--text-tertiary)]">
                  {t("company.current")}
                </span>
              </span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          className={cn(
            "flex h-12 w-full items-center gap-4 rounded-[14px] pl-5 pr-4 text-base font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            isCollapsed && "justify-center px-0",
          )}
          title={isCollapsed ? t("nav.logout") : undefined}
          aria-label={t("nav.logout")}
        >
          <LogOut className="size-[22px] shrink-0" aria-hidden="true" />
          {!isCollapsed && t("nav.logout")}
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside data-global-sidebar className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--border-default)] bg-[var(--surface-default)] transition-[width] duration-150 motion-reduce:transition-none lg:flex", collapsed ? "w-[76px]" : "w-[240px]")}>{renderSidebar(collapsed)}</aside>
      {mobileOpen && <button className="fixed inset-0 z-40 bg-[#1F2937]/35 backdrop-blur-[2px] lg:hidden" aria-label={t("nav.close")} onClick={() => onMobileOpenChange(false)} />}
      <aside
        data-global-sidebar
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[var(--surface-default)] shadow-[var(--shadow-overlay)] transition-[transform,visibility] duration-150 motion-reduce:transition-none lg:hidden",
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full pointer-events-none",
        )}
      >
        {renderSidebar(false)}
      </aside>
    </>
  );
}
