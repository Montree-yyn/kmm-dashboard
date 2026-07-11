import type { ReactNode } from "react";
import { Card } from "../ui/card";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingSkeleton } from "./loading-skeleton";

type TableCardProps = {
  title: string;
  children: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  exportAction?: ReactNode;
  pagination?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  error?: string;
};

export function TableCard({ title, children, search, filters, exportAction, pagination, loading = false, empty = false, error }: TableCardProps) {
  return (
    <Card className="rounded-2xl border-[#E8EAED] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[#1F2937]">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">{search}{filters}{exportAction}</div>
      </div>
      <div className="mt-6">{loading ? <LoadingSkeleton variant="table" /> : error ? <ErrorState message={error} /> : empty ? <EmptyState /> : children}</div>
      {pagination && <div className="mt-5">{pagination}</div>}
    </Card>
  );
}
