"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "../auth/auth-gate";
import { AppSidebar } from "../navigation/app-sidebar";
import { cn } from "../../lib/utils";
import { GlobalHeader } from "./global-header";
import { CompanyProvider } from "../../src/context/CompanyContext";
import { useCompany } from "../../src/hooks/useCompany";

const shellRoutePrefixes = [
  "/dashboard",
  "/daily-management",
  "/sales",
  "/booking",
  "/stock",
  "/marketing",
  "/weather",
  "/settings",
  "/expense",
  "/team",
  "/data-hub",
] as const;

function routeUsesAppShell(pathname: string) {
  return shellRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function GlobalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!routeUsesAppShell(pathname)) return children;

  return (
    <AuthGate>
      <CompanyProvider>
        <CompanyAppShell>{children}</CompanyAppShell>
      </CompanyProvider>
    </AuthGate>
  );
}

function CompanyAppShell({ children }: { children: React.ReactNode }) {
  const { selectedCompany, loading, error, refreshCompanies } = useCompany();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--surface-canvas)] px-6 text-[var(--text-primary)]">
        <div className="text-center" role="status" aria-live="polite">
          <div className="mx-auto size-9 animate-spin rounded-full border-4 border-[var(--brand-100)] border-t-[var(--brand-600)] motion-reduce:animate-none" />
          <p className="mt-4 text-sm font-semibold text-[var(--text-secondary)]">Loading company access…</p>
        </div>
      </div>
    );
  }

  if (error || !selectedCompany) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--surface-canvas)] p-4 text-[var(--text-primary)]">
        <section className="kmm-surface w-full max-w-lg p-6 text-center" role="alert">
          <h1 className="text-xl font-semibold">Company access could not be loaded</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{error ?? "No active company membership is available."}</p>
          <button type="button" onClick={() => void refreshCompanies()} className="mt-5 min-h-11 rounded-[var(--radius-control)] bg-[var(--brand-600)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">Try again</button>
        </section>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-clip bg-[var(--surface-canvas)] text-[var(--text-primary)]"
      data-global-app-shell
      data-active-company={selectedCompany.id}
    >
      <AppSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapsedChange={setCollapsed}
        onMobileOpenChange={setMobileOpen}
      />
      <div
        className={cn(
          "min-h-screen min-w-0 transition-[padding] duration-150 motion-reduce:transition-none",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[216px]",
        )}
      >
        <GlobalHeader onOpenNavigation={() => setMobileOpen(true)} />
        <div key={selectedCompany.id}>{children}</div>
      </div>
    </div>
  );
}
