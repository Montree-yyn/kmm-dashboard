import { dailyManagementMock } from "./mock-data";

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

const DRAFT_KEY = "kmm:daily-management:input-draft:v1";
const PUBLISHED_KEY = "kmm:daily-management:input-published:v1";
export const DAILY_MANAGEMENT_INPUT_PUBLISHED = "kmm:daily-management-input-published";

export const defaultDailyManagementInput: DailyManagementInputSnapshot = {
  version: 1,
  reportDate: dailyManagementMock.reportDate,
  branch: "All Branches",
  preparedBy: "KMM Sales Division",
  target: { mtdTarget: 48, expectedPace: 14 },
  bookingLifecycle: {
    waitApprove: 3,
    waitDelivery: 74,
    deliveredToday: 2,
    cancelUnits: dailyManagementMock.cancellation.total,
    cancelReason: dailyManagementMock.cancellation.reason,
  },
  actions: dailyManagementMock.actions.map((item) => ({
    title: item.title,
    detail: item.detail,
    owner: item.owner,
    nextStep: item.action,
    priority: item.tone === "negative" ? "critical" : "warning",
  })),
  notes: {
    situation: dailyManagementMock.notes[0].items.join("\n"),
    decision: dailyManagementMock.notes[1].items.join("\n"),
    tomorrowFocus: dailyManagementMock.notes[2].items.join("\n"),
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
    return value?.version === 1 ? value : null;
  } catch {
    return null;
  }
}

export function loadDailyManagementDraft() {
  return read(DRAFT_KEY) ?? cloneDefault();
}

export function loadPublishedDailyManagementInput() {
  return read(PUBLISHED_KEY) ?? cloneDefault();
}

export function saveDailyManagementDraft(snapshot: DailyManagementInputSnapshot) {
  const saved = { ...structuredClone(snapshot), savedAt: new Date().toISOString() };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
  return saved;
}

export function publishDailyManagementInput(snapshot: DailyManagementInputSnapshot) {
  const published = {
    ...structuredClone(snapshot),
    savedAt: snapshot.savedAt ?? new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(published));
  window.localStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
  window.dispatchEvent(new CustomEvent(DAILY_MANAGEMENT_INPUT_PUBLISHED));
  return published;
}
