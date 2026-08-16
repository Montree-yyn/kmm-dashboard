/**
 * Client-side request deduplication + short-TTL cache (performance audit F5).
 *
 * Solves three duplicate-fetch problems without touching business logic, the
 * API contract, or any page's loading/error behavior:
 *
 * 1. In-flight dedupe — concurrent callers for the same key share one promise
 *    (covers React strict-mode double effects and multi-consumer mounts).
 * 2. TTL cache — navigating back and forth between pages that read the same
 *    dataset reuses a fresh-enough payload instead of re-fetching.
 * 3. Invalidation — `kmm:sales-imported` (Data Hub re-import) clears
 *    sales/operations entries; `kmm:company-changed` clears everything.
 *
 * Errors are never cached, so a retry always re-fetches and the page's own
 * ErrorState behavior is unchanged. `force: true` (explicit user refresh)
 * bypasses the TTL cache while still deduplicating in-flight work.
 */
type ResolvedEntry<T> = { status: "resolved"; settledAt: number; value: T };

export type ClientDataLayerOptions = {
  /** Skip the TTL cache and always fetch (explicit user refresh). */
  force?: boolean;
  /** Per-request TTL override in milliseconds. */
  ttlMs?: number;
};

export class ClientDataLayer {
  private readonly defaultTtlMs: number;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly cache = new Map<string, ResolvedEntry<unknown>>();
  private listenersRegistered = false;

  constructor(defaultTtlMs = 30_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  request<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: ClientDataLayerOptions = {},
  ): Promise<T> {
    this.ensureListeners();

    // 1. In-flight dedupe: share the exact pending promise.
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    // 2. TTL cache hit (unless an explicit refresh bypasses it).
    if (!options.force) {
      const entry = this.cache.get(key);
      if (
        entry &&
        Date.now() - entry.settledAt <= (options.ttlMs ?? this.defaultTtlMs)
      ) {
        return Promise.resolve(entry.value as T);
      }
    }

    // 3. Fetch once; resolve values into the cache, never rejections.
    const promise = fetcher()
      .then((value) => {
        this.cache.set(key, {
          status: "resolved",
          settledAt: Date.now(),
          value,
        });
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  }

  /** Drop one exact key (cache + any pending work). */
  invalidate(key: string): void {
    this.inFlight.delete(key);
    this.cache.delete(key);
  }

  /** Drop every key that starts with the given prefix. */
  invalidatePrefix(prefix: string): void {
    for (const key of [...this.inFlight.keys()]) {
      if (key.startsWith(prefix)) this.inFlight.delete(key);
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  /** Drop every cached entry and pending request. */
  clear(): void {
    this.inFlight.clear();
    this.cache.clear();
  }

  /** True when the layer currently holds any in-flight or cached work. */
  get size(): number {
    return this.inFlight.size + this.cache.size;
  }

  private ensureListeners(): void {
    if (this.listenersRegistered || typeof window === "undefined") return;
    this.listenersRegistered = true;
    window.addEventListener("kmm:sales-imported", () => {
      // Data Hub re-import may change sales, booking or stock rows.
      this.invalidatePrefix("sales:");
      this.invalidatePrefix("operations:");
    });
    window.addEventListener("kmm:company-changed", () => this.clear());
  }
}

/** Application-wide singleton shared by every client module. */
export const clientDataLayer = new ClientDataLayer();

