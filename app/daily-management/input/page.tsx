import { DailyManagementInputPage } from "../../../components/daily-management/daily-management-input-page";
import { DAILY_MANAGEMENT_REPORT_ENABLED } from "../../../lib/features";

export default function DailyManagementInputRoute() {
  if (!DAILY_MANAGEMENT_REPORT_ENABLED) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-3xl place-items-center p-6">
        <section className="kmm-surface w-full p-8 text-center">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Daily Management Inputs are not enabled</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Enable the Daily Management Report feature before using this local prototype.</p>
        </section>
      </main>
    );
  }
  return <DailyManagementInputPage />;
}
