import { DailyManagementPage } from "../../components/daily-management/daily-management-page";
import { DAILY_MANAGEMENT_REPORT_ENABLED } from "../../lib/features";

export default function DailyManagementRoute() {
  if (!DAILY_MANAGEMENT_REPORT_ENABLED) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-3xl place-items-center p-6">
        <section className="kmm-surface w-full p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-600)]">Feature preview</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Daily Management Report is not enabled</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Phase 1 remains hidden from production navigation until data reconciliation and release approval are complete.</p>
        </section>
      </main>
    );
  }
  return <DailyManagementPage />;
}
