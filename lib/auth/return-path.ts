const DEFAULT_APP_PATH = "/dashboard";

export function safeAppReturnPath(value: string | null | undefined, fallback = DEFAULT_APP_PATH) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://kmm.local");
    if (url.origin !== "https://kmm.local" || url.pathname === "/login") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginPathFor(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(safeAppReturnPath(returnTo))}`;
}
