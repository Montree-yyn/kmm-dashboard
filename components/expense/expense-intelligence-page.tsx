"use client";

import { ReceiptText } from "lucide-react";
import { Card } from "../ui/card";
import { useLocale } from "../../src/hooks/useLocale";

export function ExpenseIntelligencePage() {
  const { t } = useLocale();
  return (
    <div className="kmm-expense-page min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
          <div className="space-y-5 xl:space-y-6">
            <section aria-labelledby="expense-title">
              <div
                className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]"
                aria-hidden="true"
              />
              <h1
                id="expense-title"
                className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-[30px]"
              >
                {t("route.expense.title")}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                {t("route.expense.subtitle")}
              </p>
            </section>

            <section aria-labelledby="expense-empty-title">
              <Card className="grid min-h-[360px] place-items-center rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-6 shadow-[var(--shadow-card)] sm:min-h-[420px] sm:p-8">
                <div className="max-w-md text-center">
                  <span
                    className="mx-auto grid size-12 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--brand-50)] text-[var(--brand-600)]"
                    aria-hidden="true"
                  >
                    <ReceiptText size={22} />
                  </span>
                  <h2
                    id="expense-empty-title"
                    className="mt-5 text-xl font-semibold text-[var(--text-primary)]"
                  >
                    {t("expense.emptyTitle")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {t("expense.emptyDescription")}
                  </p>
                </div>
              </Card>
            </section>
          </div>
      </main>
    </div>
  );
}
