"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Building2,
  DatabaseBackup,
  FileClock,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  SettingsCard,
  type SettingsCardDefinition,
} from "./settings-card";
import { SettingsSearch } from "./settings-search";

const settingsCards: SettingsCardDefinition[] = [
  {
    id: "company",
    title: "Company Management",
    description: ["Company profile", "Branch", "Department", "Fiscal Year"],
    icon: Building2,
  },
  {
    id: "users",
    title: "User Management",
    description: ["Users", "Profile", "Access"],
    icon: Users,
  },
  {
    id: "roles",
    title: "Roles & Permissions",
    description: ["Role", "Permission", "Approval"],
    icon: ShieldCheck,
  },
  {
    id: "ai",
    title: "AI Settings",
    description: ["AI Model", "Memory", "Prompt", "Agent"],
    icon: Bot,
  },
  {
    id: "dashboard",
    title: "Dashboard Settings",
    description: ["Widgets", "Layout", "KPI"],
    icon: LayoutDashboard,
  },
  {
    id: "theme",
    title: "Theme & Language",
    description: ["Theme", "Dark", "Light", "Language"],
    icon: Palette,
  },
  {
    id: "backup",
    title: "Backup",
    description: ["Automatic Backup", "Restore", "Schedule"],
    icon: DatabaseBackup,
  },
  {
    id: "audit",
    title: "Audit Log",
    description: ["History", "Activity", "Security"],
    icon: FileClock,
  },
];

export function SettingsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return settingsCards;
    return settingsCards.filter((item) =>
      [item.title, ...item.description]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  function selectCard(item: SettingsCardDefinition) {
    if (item.id === "company") {
      router.push("/settings/company");
      return;
    }
    setSelectedId(item.id);
  }

  return (
    <div className="kmm-settings-page min-h-[calc(100vh-72px)] bg-[#F7F8FA] text-[#111827]">
      <main className="mx-auto max-w-[1720px] p-4 sm:p-5 xl:p-6">
          <div className="grid min-w-0 gap-5 xl:gap-6">
            <div className="min-w-0 space-y-5 xl:space-y-6">
              <div className="max-w-xl">
                <SettingsSearch
                  value={query}
                  onChange={setQuery}
                  inputRef={searchRef}
                />
              </div>
              <section aria-labelledby="settings-overview-title">
                <h1
                  id="settings-overview-title"
                  className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-[30px]"
                >
                  Settings Overview
                </h1>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  Manage your enterprise configuration.
                </p>
              </section>

              <section aria-label="Settings categories">
                {visibleCards.length ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {visibleCards.map((item) => (
                      <SettingsCard
                        key={item.id}
                        item={item}
                        selected={selectedId === item.id}
                        onSelect={selectCard}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-64 place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] bg-[var(--surface-default)] p-8 text-center">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">
                        No settings found
                      </h2>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Try a different search term.
                      </p>
                      <button
                        type="button"
                        className="mt-4 min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        onClick={() => {
                          setQuery("");
                          searchRef.current?.focus();
                        }}
                      >
                        Clear search
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <p className="sr-only" aria-live="polite">
                {selectedId
                  ? `${settingsCards.find((item) => item.id === selectedId)?.title} selected`
                  : ""}
              </p>
            </div>

          </div>
      </main>
    </div>
  );
}
