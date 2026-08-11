import { ALL_BRANCHES, canonicalDailyBranch } from "./branch";
import { dateInTimeZone } from "./date";

export type DailyManagementActionInput = {
  title: string;
  detail: string;
  owner: string;
  nextStep: string;
  priority: "critical" | "warning" | "attention";
};

export type DailyManagementInputSnapshot = {
  version: 1;
  reportDate: string;
  branch: string;
  preparedBy: string;
  target: {
    mtdTarget: number;
    expectedPace: number;
  };
  bookingLifecycle: {
    waitApprove: number;
    waitDelivery: number;
    deliveredToday: number;
    cancelUnits: number;
    cancelReason: string;
  };
  actions: DailyManagementActionInput[];
  notes: {
    situation: string;
    decision: string;
    tomorrowFocus: string;
  };
  savedAt: string | null;
  publishedAt: string | null;
};

// v2 invalidates Phase 1 browser caches that were seeded with illustrative values.
// D1 remains the governed source; localStorage is only a same-browser draft cache.
const DRAFT_KEY = "kmm:daily-management:input-draft:v2";
const PUBLISHED_KEY = "kmm:daily-management:input-published:v2";
export const DAILY_MANAGEMENT_INPUT_PUBLISHED = "kmm:daily-management-input-published";

export const defaultDailyManagementInput: DailyManagementInputSnapshot = {
  version: 1,
  reportDate: dateInTimeZone(new Date()),
  branch: ALL_BRANCHES,
  preparedBy: "KMM Sales Division",
  target: { mtdTarget: 0, expectedPace: 0 },
  bookingLifecycle: {
    waitApprove: 0,
    waitDelivery: 0,
    deliveredToday: 0,
    cancelUnits: 0,
    cancelReason: "",
  },
  actions: [],
  notes: {
    situation: "",
    decision: "",
    tomorrowFocus: "",
  },
  savedAt: null,
  publishedAt: null,
};

function cloneDefault() {
  return structuredClone(defaultDailyManagementInput);
}

function read(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "null") as DailyManagementInputSnapshot | null;
    return value?.version === 1
      ? { ...value, branch: canonicalDailyBranch(value.branch) || ALL_BRANCHES }
      : null;
  } catch {
    return null;
  }
}

export function loadDailyManagementDraft() {
  return read(DRAFT_KEY) ?? cloneDefault();
}

export function saveDailyManagementDraft(snapshot: DailyManagementInputSnapshot) {
  const saved = { ...structuredClone(snapshot), savedAt: snapshot.savedAt ?? new Date().toISOString() };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
  return saved;
}

export function publishDailyManagementInput(snapshot: DailyManagementInputSnapshot) {
  const published = {
    ...structuredClone(snapshot),
    savedAt: snapshot.savedAt ?? new Date().toISOString(),
    publishedAt: snapshot.publishedAt ?? new Date().toISOString(),
  };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(published));
  window.localStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
  window.dispatchEvent(new CustomEvent(DAILY_MANAGEMENT_INPUT_PUBLISHED));
  return published;
}
