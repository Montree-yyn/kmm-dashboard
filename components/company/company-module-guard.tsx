"use client";

import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { CompanyModule } from "../../lib/company-context/types";
import { useCompany } from "../../src/hooks/useCompany";

const moduleNames: Partial<Record<CompanyModule, string>> = {
  marketing: "Marketing Intelligence",
  expense: "Expense Intelligence",
};

export function CompanyModuleGuard({
  module,
  children,
}: {
  module: CompanyModule;
  children: ReactNode;
}) {
  const { selectedCompany } = useCompany();
  if (!selectedCompany || selectedCompany.capabilities[module]) return children;
  const moduleName = moduleNames[module] ?? "This module";

  return (
    <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-3xl place-items-center p-4 sm:p-6">
      <section className="kmm-surface w-full p-6 sm:p-8" aria-labelledby="module-unavailable-title">
        <span className="grid size-11 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]">
          <ShieldAlert size={21} aria-hidden="true" />
        </span>
        <h1 id="module-unavailable-title" className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          {moduleName} is not available for {selectedCompany.code}
        </h1>
        <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[var(--text-secondary)]">
          No verified {selectedCompany.name} dataset is connected to this module. It is disabled so KMM data and geography cannot be shown under the wrong company.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-600)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">
            <Building2 size={16} aria-hidden="true" /> Return to {selectedCompany.code} Dashboard
          </Link>
          <Link href="/data-hub" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            Open Data Hub
          </Link>
        </div>
      </section>
    </main>
  );
}
