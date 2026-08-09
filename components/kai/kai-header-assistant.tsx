"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  ChevronDown,
  FileSearch,
  ExternalLink,
  GitBranch,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { askKai } from "../../lib/kai/client";
import type { KaiErrorCode, KaiMessage, KaiSource } from "../../lib/kai/types";
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

type ConversationMessage = KaiMessage & { id: string; sources?: KaiSource[] };
type AssistantState =
  | "online"
  | "connecting"
  | "thinking"
  | "error"
  | "quota"
  | "offline";

const CHAT_HISTORY_LIMIT = 20;
const MAX_MESSAGE_LENGTH = 4_000;

const starterPrompts = [
  "ประเทศไทยมีกี่จังหวัด",
  "Explain artificial intelligence in simple terms.",
  "Gross profit คืออะไร",
  "รถเกี่ยวข้าวทำงานอย่างไร",
];

const quickActions: Array<{
  id: KaiAction;
  label: string;
  icon: typeof Building2;
  href?: string;
}> = [
  { id: "configure-company", label: "Configure Company", icon: Building2, href: "/settings/company" },
  { id: "create-branch", label: "Create Branch", icon: GitBranch, href: "/settings/company" },
  { id: "invite-user", label: "Invite User", icon: UserPlus, href: "/settings" },
  { id: "check-permissions", label: "Check Permissions", icon: ShieldCheck, href: "/settings" },
  { id: "explain-settings", label: "Explain Settings", icon: Bot, href: "/settings" },
  { id: "search-documentation", label: "Search Documentation", icon: FileSearch },
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

const stateLabels: Record<AssistantState, string> = {
  online: "Online",
  connecting: "Connecting",
  thinking: "Thinking",
  error: "Needs attention",
  quota: "Quota reached",
  offline: "Offline",
};

export function KaiHeaderAssistant({
  suggestions = [],
  onAction,
  className,
}: KaiHeaderAssistantProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [assistantState, setAssistantState] = useState<AssistantState>("online");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState("KAI is thinking");
  const panelRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const busy = assistantState === "connecting" || assistantState === "thinking";
  const filteredDestinations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return destinations;
    return destinations.filter((item) => item.label.toLowerCase().includes(normalized));
  }, [query]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
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
    const frame = window.requestAnimationFrame(() => composerRef.current?.focus());
    const handlePanelKeyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
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

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, assistantState]);

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

  async function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;

    const previousHistory = messages
      .slice(-CHAT_HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content }));
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };
    setMessages((current) => [...current, userMessage].slice(-CHAT_HISTORY_LIMIT));
    setDraft("");
    setStatusMessage(null);
    setProgressMessage(getKaiProgressMessage(message));
    setAssistantState("connecting");

    const result = await askKai(message, previousHistory, () => {
      setAssistantState("thinking");
    });
    if (result.success) {
      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        sources: result.sources,
      };
      setMessages((current) =>
        [...current, assistantMessage].slice(-CHAT_HISTORY_LIMIT),
      );
      setAssistantState("online");
      return;
    }

    setAssistantState(stateForError(result.error.code));
    setStatusMessage(result.error.message);
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  function clearConversation() {
    setMessages([]);
    setStatusMessage(null);
    setProgressMessage("KAI is thinking");
    setAssistantState("online");
    composerRef.current?.focus();
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[20px] border border-[#E8E8E8] bg-white px-3 text-[var(--text-primary)]",
          "transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:border-[var(--brand-100)] hover:bg-[var(--brand-50)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:px-4",
          open && "border-[var(--brand-100)] bg-[var(--brand-50)]",
          className,
        )}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close KAI Assistant" : "Open KAI Assistant"}
        aria-expanded={open}
        aria-controls="kai-assistant-panel"
        title="KAI Assistant (⌘/Ctrl + K)"
      >
        <Sparkles size={17} className="shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
        <span className="text-sm font-semibold">KAI</span>
        <span className="hidden text-[11px] text-[var(--text-tertiary)] 2xl:inline">AI Assistant</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <aside
          ref={panelRef}
          id="kai-assistant-panel"
          className="kmm-kai-panel fixed z-[1000] flex overflow-hidden border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-overlay)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kai-panel-title"
        >
          <div className="flex min-h-0 w-full flex-col">
            <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--brand-50)] text-[var(--brand-600)]">
                <Sparkles size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 id="kai-panel-title" className="text-base font-semibold text-[var(--text-primary)]">KAI</h2>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    assistantState === "online" && "bg-[var(--status-success-bg)] text-[var(--status-success)]",
                    busy && "bg-[var(--status-info-bg)] text-[var(--status-info)]",
                    assistantState === "quota" && "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
                    (assistantState === "error" || assistantState === "offline") && "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
                  )}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                    {stateLabels[assistantState]}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Kubota AI<span className="sr-only"> · Kubota Artificial Intelligence</span>
                </p>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  className="grid size-10 place-items-center rounded-[var(--radius-control)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  onClick={clearConversation}
                  aria-label="Clear KAI conversation"
                  title="Clear conversation"
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="grid size-10 place-items-center rounded-[var(--radius-control)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                onClick={() => setOpen(false)}
                aria-label="Close KAI Assistant"
                aria-controls="kai-assistant-panel"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5" aria-label="KAI conversation">
              {messages.length === 0 ? (
                <div className="flex min-h-full flex-col justify-center py-4">
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-[var(--brand-100)] bg-[var(--brand-50)] text-[var(--brand-600)]">
                    <Bot size={22} aria-hidden="true" />
                  </div>
                  <div className="mx-auto mt-4 max-w-[310px] text-center">
                    <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">How can I help?</h3>
                    <p className="mt-1.5 text-sm leading-5 text-[var(--text-secondary)]">
                      Ask in Thai, English, or Myanmar. Approved KMM members can also request company-wide Sales, Booking, Stock, and GP summaries.
                    </p>
                  </div>
                  <div className="mt-6 grid gap-2" aria-label="Suggested questions">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2.5 text-left text-sm leading-5 text-[var(--text-secondary)] transition-colors hover:border-[var(--brand-100)] hover:bg-[var(--brand-50)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        onClick={() => { setDraft(prompt); composerRef.current?.focus(); }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ol className="space-y-4" aria-label="Conversation messages">
                  {messages.map((message) => (
                    <li key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                        message.role === "user"
                          ? "rounded-br-md bg-[var(--brand-600)] text-white"
                          : "rounded-bl-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-primary)]",
                      )}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                          <details className="group mt-2.5 border-t border-[var(--border-default)] pt-2">
                            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                              Sources · {message.sources.length}
                              <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                            </summary>
                            <ol className="space-y-2 pb-1 pt-1">
                              {message.sources.map((source, index) => (
                                <li key={source.url} className="rounded-lg bg-[var(--surface-default)] p-2.5">
                                  <div className="flex items-start gap-2">
                                    <span className="mt-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">{index + 1}</span>
                                    <div className="min-w-0 flex-1">
                                      <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold leading-4 text-[var(--text-primary)] underline-offset-2 hover:text-[var(--brand-700)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                                        <span>{source.title}</span>
                                        <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
                                      </a>
                                      <p className="text-[10px] text-[var(--text-tertiary)]">
                                        {source.source}{source.publishedAt ? ` · ${formatSourceDate(source.publishedAt)}` : ""}
                                      </p>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
                      </div>
                    </li>
                  ))}
                  {busy && (
                    <li className="flex justify-start" role="status" aria-live="polite">
                      <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)]">
                        <span className="flex gap-1" aria-hidden="true">
                          <span className="size-1.5 animate-pulse rounded-full bg-[var(--brand-500)]" />
                          <span className="size-1.5 animate-pulse rounded-full bg-[var(--brand-400)] [animation-delay:120ms]" />
                          <span className="size-1.5 animate-pulse rounded-full bg-[var(--brand-300)] [animation-delay:240ms]" />
                        </span>
                        {assistantState === "connecting" ? "Connecting to KAI" : progressMessage}
                      </div>
                    </li>
                  )}
                </ol>
              )}
              <div ref={conversationEndRef} />
            </div>

            <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-default)] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 sm:px-5">
              {statusMessage && (
                <div
                  className={cn(
                    "mb-3 flex items-start gap-2 rounded-[var(--radius-control-lg)] px-3 py-2.5 text-xs leading-5",
                    assistantState === "quota"
                      ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                      : "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
                  )}
                  role="alert"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{statusMessage}</span>
                </div>
              )}

              <form onSubmit={submitMessage} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-2 transition-[border-color,box-shadow] focus-within:border-[var(--brand-400)] focus-within:ring-2 focus-within:ring-[var(--brand-focus)]">
                <label htmlFor="kai-message" className="sr-only">Message KAI</label>
                <textarea
                  ref={composerRef}
                  id="kai-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  maxLength={MAX_MESSAGE_LENGTH}
                  rows={2}
                  disabled={busy}
                  placeholder="Message KAI..."
                  className="max-h-32 min-h-12 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] disabled:cursor-wait"
                />
                <div className="flex items-center justify-between gap-3 px-1 pb-0.5">
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {draft.length > 3_500 ? `${draft.length.toLocaleString()} / ${MAX_MESSAGE_LENGTH.toLocaleString()}` : "Enter to send · Shift+Enter for newline"}
                  </span>
                  <button
                    type="submit"
                    disabled={!draft.trim() || busy}
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-600)] text-white transition-colors hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--text-disabled)]"
                    aria-label="Send message to KAI"
                  >
                    <Send size={17} aria-hidden="true" />
                  </button>
                </div>
              </form>
              <p className="mt-2 text-center text-[10px] leading-4 text-[var(--text-tertiary)]">KAI may make mistakes. Verify important information.</p>

              <details className="group mt-3 border-t border-[var(--border-subtle)] pt-2">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-[var(--radius-control)] px-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                  More actions
                  <ChevronDown size={15} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="max-h-64 overflow-y-auto pb-2 pt-3">
                  <section aria-labelledby="kai-quick-actions">
                    <h3 id="kai-quick-actions" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Quick Actions</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button key={action.id} type="button" className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 text-left text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-100)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" onClick={() => runAction(action.id, action.href)}>
                            <Icon size={15} className="shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="mt-4" aria-labelledby="kai-suggestions">
                    <h3 id="kai-suggestions" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Recent Suggestions</h3>
                    {suggestions.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {suggestions.map((suggestion) => <li key={suggestion} className="rounded-[var(--radius-control-lg)] bg-[var(--brand-50)] px-3 py-2.5 text-xs leading-5 text-[var(--text-secondary)]">{suggestion}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-2 rounded-[var(--radius-control-lg)] border border-dashed border-[var(--border-default)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">No current suggestions.</p>
                    )}
                  </section>

                  <section className="mt-4" aria-labelledby="kai-global-search">
                    <h3 id="kai-global-search" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Global Search</h3>
                    <div className="relative mt-2">
                      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
                      <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search KMM..." aria-label="Search KMM" className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-white pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]" />
                    </div>
                    <div className="mt-2 divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control-lg)] border border-[var(--border-default)]">
                      {filteredDestinations.map((destination) => (
                        <button key={destination.label} type="button" disabled={!destination.href} className="flex min-h-11 w-full items-center justify-between px-3 text-left text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)]" onClick={() => { if (!destination.href) return; router.push(destination.href); setOpen(false); }}>
                          {destination.label}
                          {destination.href ? <ArrowRight size={14} aria-hidden="true" /> : <span className="text-[10px]">Planned</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              </details>
            </div>
          </div>
        </aside>,
        document.body,
      )}
    </>
  );
}

function stateForError(code: KaiErrorCode): AssistantState {
  if (code === "quota_exceeded" || code === "rate_limited") return "quota";
  if (code === "offline" || code === "timeout") return "offline";
  return "error";
}

function getKaiProgressMessage(message: string) {
  if (/(วันนี้|ตอนนี้|ล่าสุด|ข่าว|ราคา|อากาศ|today|latest|current|news|price|weather|ယနေ့|ယခု|နောက်ဆုံး|သတင်း)/i.test(message)) {
    return "Searching current sources";
  }
  if (/(คำนวณ|เท่าไร|เปอร์เซ็นต์|calculate|percent|\d\s*[+\-*/])/i.test(message)) {
    return "Calculating";
  }
  return "KAI is thinking";
}

function formatSourceDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
