import {
  Building2,
  CalendarDays,
  Coins,
  Gauge,
  Globe2,
  Landmark,
  Network,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { CompanySection } from "../../../lib/company-management/types";
import { cn } from "../../../lib/utils";

export const companySections: Array<{
  id: CompanySection;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "general", label: "General Information", icon: Building2 },
  { id: "branches", label: "Branches", icon: Landmark },
  { id: "departments", label: "Departments", icon: Network },
  { id: "fiscal", label: "Fiscal Year", icon: CalendarDays },
  { id: "currency", label: "Currency", icon: Coins },
  { id: "localization", label: "Language & Time Zone", icon: Globe2 },
  { id: "calendar", label: "Working Calendar", icon: Waypoints },
];

export function CompanyNavigation({
  active,
  onChange,
}: {
  active: CompanySection;
  onChange: (section: CompanySection) => void;
}) {
  return (
    <>
      <label className="block lg:hidden">
        <span className="sr-only">Company Management section</span>
        <select
          value={active}
          onChange={(event) => onChange(event.target.value as CompanySection)}
          className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        >
          {companySections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </label>

      <nav
        className="sticky top-24 hidden self-start rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-2 shadow-[var(--shadow-card)] lg:block"
        aria-label="Company Management"
      >
        {companySections.map((section) => {
          const Icon = section.icon;
          const selected = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-control-lg)] px-3 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                selected
                  ? "bg-[var(--brand-50)] text-[var(--brand-600)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]",
              )}
              onClick={() => onChange(section.id)}
              aria-current={selected ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
