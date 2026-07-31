"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Bot,
  Building2,
  FileSearch,
  GitBranch,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

export type KaiAction =
  | "configure-company"
  | "create-branch"
  | "invite-user"
  | "check-permissions"
  | "explain-settings"
  | "search-documentation";

type KaiHeaderAssistantProps = {
  suggestions?: string[];
  onAction?: (action: KaiAction) => void;
  className?: string;
};

const quickActions: Array<{
  id: KaiAction;
  label: string;
  icon: typeof Building2;
  href?: string;
}> = [
  {
    id: "configure-company",
    label: "Configure Company",
    icon: Building2,
    href: "/settings/company",
  },
  {
    id: "create-branch",
    label: "Create Branch",
    icon: GitBranch,
    href: "/settings/company",
  },
  {
    id: "invite-user",
    label: "Invite User",
    icon: UserPlus,
    href: "/settings",
  },
  {
    id: "check-permissions",
    label: "Check Permissions",
    icon: ShieldCheck,
    href: "/settings",
  },
  {
    id: "explain-settings",
    label: "Explain Settings",
    icon: Bot,
    href: "/settings",
  },
  {
    id: "search-documentation",
    label: "Search Documentation",
    icon: FileSearch,
  },
];

const destinations = [
  { label: "Settings", href: "/settings" },
  { label: "Users", href: "/settings" },
  { label: "Reports", href: null },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Booking", href: "/booking" },
  { label: "Stock", href: "/stock" },
  { label: "Sales", href: "/sales" },
  { label: "Customers", href: null },
  { label: "AI Knowledge", href: null },
] as const;

export function KaiHeaderAssistant({
  suggestions = [],
  onAction,
  className,
}: KaiHeaderAssistantProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filteredDestinations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return destinations;
    return destinations.filter((item) =>
      item.label.toLowerCase().includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const handlePanelKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handlePanelKeyboard);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handlePanelKeyboard);
      previousFocus?.focus();
    };
  }, [open]);

  function runAction(action: KaiAction, href?: string) {
    if (action === "search-documentation") {
      setQuery("documentation");
      searchRef.current?.focus();
      return;
    }
    onAction?.(action);
    if (!onAction && href) router.push(href);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[20px] border border-[#E8E8E8] bg-white px-3 text-[var(--text-primary)]",
          "transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:border-[var(--brand-100)] hover:bg-[var(--brand-50)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
          "sm:px-4",
          open && "border-[var(--brand-100)] bg-[var(--brand-50)]",
          className,
        )}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close KAI Assistant" : "Open KAI Assistant"}
        aria-expanded={open}
        aria-controls="kai-assistant-panel"
        title="KAI Assistant (⌘/Ctrl + K)"
      >
        <Sparkles
          size={17}
          className="shrink-0 text-[var(--brand-600)]"
          aria-hidden="true"
        />
        <span className="text-sm font-semibold">KAI</span>
        <span className="hidden text-[11px] text-[var(--text-tertiary)] 2xl:inline">
          AI Assistant
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <aside
              ref={panelRef}
              id="kai-assistant-panel"
              className="kmm-kai-panel fixed z-[1000] flex overflow-hidden border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-overlay)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="kai-panel-title"
            >
              <div className="flex min-h-0 w-full flex-col">
                <header className="relative flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:pr-24">
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-tertiary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:hidden"
                onClick={() => setOpen(false)}
                aria-label="Close KAI Assistant"
              >
                <X size={18} aria-hidden="true" />
              </button>
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--brand-50)] text-[var(--brand-600)]">
                <Sparkles size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2
                    id="kai-panel-title"
                    className="text-base font-semibold text-[var(--text-primary)]"
                  >
                    KAI
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-success)]">
                    <span
                      className="size-1.5 rounded-full bg-current"
                      aria-hidden="true"
                    />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Kubota Artificial Intelligence
                </p>
              </div>
              <button
                type="button"
                className="absolute right-4 top-4 hidden h-10 items-center justify-center gap-2 rounded-[20px] border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 text-sm font-semibold text-[var(--text-primary)] transition-colors duration-150 ease-out hover:bg-[var(--brand-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:inline-flex"
                onClick={() => setOpen(false)}
                aria-label="Close KAI Assistant"
                aria-controls="kai-assistant-panel"
              >
                <Sparkles
                  size={17}
                  className="text-[var(--brand-600)]"
                  aria-hidden="true"
                />
                KAI
              </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5">
              <section aria-labelledby="kai-quick-actions">
                <h3
                  id="kai-quick-actions"
                  className="text-xs font-semibold uppercase text-[var(--text-tertiary)]"
                >
                  Quick Actions
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        className="flex min-h-12 items-center gap-2 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 text-left text-xs font-semibold text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--brand-100)] hover:bg-[var(--brand-50)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        onClick={() => runAction(action.id, action.href)}
                      >
                        <Icon
                          size={16}
                          className="shrink-0 text-[var(--brand-600)]"
                          aria-hidden="true"
                        />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-6" aria-labelledby="kai-suggestions">
                <h3
                  id="kai-suggestions"
                  className="text-xs font-semibold uppercase text-[var(--text-tertiary)]"
                >
                  Recent Suggestions
                </h3>
                {suggestions.length ? (
                  <ul className="mt-3 space-y-2">
                    {suggestions.map((suggestion) => (
                      <li
                        key={suggestion}
                        className="rounded-[var(--radius-control-lg)] bg-[var(--brand-50)] px-3 py-3 text-sm leading-5 text-[var(--text-secondary)]"
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-[var(--radius-control-lg)] border border-dashed border-[var(--border-default)] px-3 py-4 text-sm text-[var(--text-secondary)]">
                    No current suggestions.
                  </p>
                )}
              </section>

              <section className="mt-6" aria-labelledby="kai-global-search">
                <h3
                  id="kai-global-search"
                  className="text-xs font-semibold uppercase text-[var(--text-tertiary)]"
                >
                  Global Search
                </h3>
                <div className="relative mt-3">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search KMM..."
                    aria-label="Search KMM"
                    className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
                <div className="mt-2 divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control-lg)] border border-[var(--border-default)]">
                  {filteredDestinations.map((destination) => (
                    <button
                      key={destination.label}
                      type="button"
                      disabled={!destination.href}
                      className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 first:rounded-t-[var(--radius-control-lg)] last:rounded-b-[var(--radius-control-lg)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)]"
                      onClick={() => {
                        if (!destination.href) return;
                        router.push(destination.href);
                        setOpen(false);
                      }}
                    >
                      {destination.label}
                      {destination.href ? (
                        <ArrowRight size={15} aria-hidden="true" />
                      ) : (
                        <span className="text-[10px] font-medium">Planned</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <section
                className="mt-6 rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] p-4"
                aria-labelledby="kai-conversation"
              >
                <h3
                  id="kai-conversation"
                  className="text-xs font-semibold uppercase text-[var(--text-tertiary)]"
                >
                  Conversation
                </h3>
                <p className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">
                  AI conversation will be available in a future release.
                </p>
              </section>
                </div>
              </div>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
