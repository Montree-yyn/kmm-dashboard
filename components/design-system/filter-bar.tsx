import type { ReactNode } from "react";
import { Card } from "../ui/card";

type FilterBarProps = {
  children: ReactNode;
  actions: ReactNode;
};

export function FilterBar({ children, actions }: FilterBarProps) {
  return (
    <Card className="border-[#E8EAED] p-4 shadow-[0_8px_24px_rgba(31,41,55,0.035)] sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-start lg:justify-end">{actions}</div>
      </div>
    </Card>
  );
}
