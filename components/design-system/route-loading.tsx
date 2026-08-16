import { Skeleton } from "../ui/skeleton";

/**
 * Route-level loading shell (Next.js App Router `loading.tsx`).
 * Shows immediately during initial JS download / client-side navigation while
 * the heavy page chunk and its data settle. Uses only the existing design
 * tokens (kmm-surface, radius-card, surface-muted) so it matches the page
 * chrome without shipping any page-specific code.
 */
export function RouteLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      data-route-loading
      className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 max-w-[70vw]" />
        </div>
        <Skeleton className="hidden h-10 w-32 sm:block" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="kmm-surface rounded-[var(--radius-card)] p-4"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-28" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[240px] w-full rounded-[var(--radius-card)] sm:h-[280px]" />
        <Skeleton className="h-[240px] w-full rounded-[var(--radius-card)] sm:h-[280px]" />
        <Skeleton className="hidden h-[280px] w-full rounded-[var(--radius-card)] lg:block" />
      </div>

      <Skeleton className="mt-4 h-40 w-full rounded-[var(--radius-card)] sm:h-56" />
    </div>
  );
}
