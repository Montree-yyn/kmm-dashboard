"use client";

import { useCallback } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Route-level error boundary (Next.js App Router `error.tsx`).
 * Catches render/runtime errors in the page subtree and offers a reset so the
 * shell (sidebar/header) stays alive instead of blanking the whole app.
 */
export function RouteErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useCallback(() => reset(), [reset]);

  return (
    <div
      role="alert"
      data-route-error
      className="mx-auto grid min-h-[calc(100vh-72px)] max-w-3xl place-items-center p-6"
    >
      <section className="kmm-surface w-full p-8 text-center">
        <AlertTriangle
          size={28}
          className="mx-auto text-[var(--status-danger)]"
          aria-hidden="true"
        />
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--status-danger)]">
          Error
        </p>
        <h1 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          The page could not be rendered. Try again, or contact the team if the
          problem persists.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">
            Error reference: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={retry}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand-600)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-700)] focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:outline-none"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Try again
        </button>
      </section>
    </div>
  );
}

