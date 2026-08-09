import {
  SearchProviderError,
  type SearchProvider,
  type SearchRequest,
  type SearchResponse,
  type SearchResult,
} from "./types";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_CACHE_ENTRIES = 100;
const cache = new Map<string, { expiresAt: number; response: SearchResponse }>();

type Fetcher = typeof fetch;

export class TavilySearchProvider implements SearchProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    if (!apiKey.trim()) {
      throw new SearchProviderError("unconfigured", "Tavily API key is unavailable.");
    }
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    validateRequest(request);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Cloudflare's global fetch must be invoked without a class receiver.
      const fetcher = this.fetcher;
      const response = await fetcher(TAVILY_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: request.query,
          search_depth: "basic",
          chunks_per_source: 2,
          max_results: Math.min(8, request.maxResults),
          topic: request.topic,
          time_range: request.timeRange,
          include_answer: false,
          include_raw_content: false,
          include_images: false,
          include_favicon: false,
          auto_parameters: false,
          include_usage: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn("Tavily search request failed", { status: response.status });
        if ([429, 432, 433].includes(response.status)) {
          throw new SearchProviderError("quota", "Tavily search quota is unavailable.");
        }
        throw new SearchProviderError("unavailable", "Tavily search request failed.");
      }

      const body = (await response.json()) as unknown;
      return normalizeResponse(body, request);
    } catch (error) {
      if (error instanceof SearchProviderError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new SearchProviderError("timeout", "Tavily search timed out.");
      }
      throw new SearchProviderError("unavailable", "Tavily search is unavailable.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class CachedSearchProvider implements SearchProvider {
  constructor(private readonly provider: SearchProvider) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const key = JSON.stringify([
      request.query.toLocaleLowerCase(),
      request.topic,
      request.timeRange,
      request.maxResults,
    ]);
    const existing = cache.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return structuredClone(existing.response);
    }

    const response = await this.provider.search(request);
    pruneCache();
    cache.set(key, {
      expiresAt: Date.now() + request.cacheTtlMs,
      response: structuredClone(response),
    });
    return response;
  }
}

function normalizeResponse(body: unknown, request: SearchRequest): SearchResponse {
  if (!body || typeof body !== "object") {
    throw new SearchProviderError("invalid_response", "Search response is invalid.");
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.results)) {
    throw new SearchProviderError("invalid_response", "Search results are missing.");
  }

  const candidates = record.results
    .map((entry) => normalizeResult(entry))
    .filter((entry): entry is SearchResult => entry !== null);
  const deduplicated = deduplicate(candidates);
  const scored = deduplicated
    .map((result, index) => ({
      result,
      score: qualityScore(result, request.query) - index * 0.01,
    }))
    .sort((left, right) => right.score - left.score);
  // Named-company news needs a real entity match, not merely a vaguely
  // adjacent machine/automotive result. It is better to return a short,
  // candid evidence set than pad the answer with weak citations.
  const ranked = (isKubotaNewsQuery(request.query)
    ? scored.filter(({ result, score }) => isKubotaSource(result) && score >= 3)
    : scored)
    .map(({ result }) => result)
    .slice(0, request.maxResults);

  return {
    query: typeof record.query === "string" && record.query.trim()
      ? record.query.trim()
      : request.query,
    results: ranked,
  };
}

function normalizeResult(value: unknown): SearchResult | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? cleanText(record.title, 240) : "";
  const snippet = typeof record.content === "string" ? cleanText(record.content, 1_200) : "";
  const url = typeof record.url === "string" ? safePublicUrl(record.url) : null;
  if (!title || !snippet || !url) return null;
  const parsed = new URL(url);
  return {
    title,
    url,
    snippet,
    source: parsed.hostname.replace(/^www\./, ""),
    publishedAt: normalizePublishedAt(record.published_date ?? record.publishedAt),
  };
}

function safePublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "::1" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return null;
    }
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function normalizePublishedAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return Number.isNaN(Date.parse(value)) ? null : value.trim();
}

function cleanText(value: string, maximumLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

function deduplicate(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const url = new URL(result.url);
    const key = `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function qualityScore(result: SearchResult, query: string) {
  const host = new URL(result.url).hostname.toLowerCase();
  const searchable = `${result.title} ${result.snippet}`.toLowerCase();
  let score = 0;
  const officialDomains: Array<[RegExp, RegExp]> = [
    [/kubota/i, /(^|\.)kubota\.(?:com|co\.jp)$/i],
    [/openai/i, /(^|\.)openai\.com$/i],
    [/cloudflare/i, /(^|\.)cloudflare\.com$/i],
  ];
  if (officialDomains.some(([subject, domain]) => subject.test(query) && domain.test(host))) {
    score += 4;
  }
  if (/kubota/i.test(query) && (host.includes("kubota") || searchable.includes("kubota"))) {
    score += 4;
  }
  if (/\.(?:gov|go\.jp|gov\.mm|go\.th)$/.test(host)) score += 3;
  if (/^(?:developers\.)?cloudflare\.com$|^(?:platform\.)?openai\.com$/.test(host)) score += 3;
  if (/(^|\.)(?:reuters\.com|apnews\.com|bbc\.com|bloomberg\.com|nikkei\.com|techcrunch\.com|theverge\.com)$/.test(host)) {
    score += 2;
  }
  if (/(medium\.com|blogspot\.|pinterest\.|quora\.com)$/.test(host)) score -= 2;
  if (result.publishedAt) score += 0.5;
  return score;
}

function isKubotaNewsQuery(query: string) {
  return /kubota/i.test(query) && /news|latest|ข่าว/i.test(query);
}

function isKubotaSource(result: SearchResult) {
  const host = new URL(result.url).hostname.toLowerCase();
  return host.includes("kubota") || /kubota/i.test(`${result.title} ${result.snippet}`);
}

function validateRequest(request: SearchRequest) {
  if (!request.query.trim() || request.query.length > 300) {
    throw new SearchProviderError("invalid_query", "Search query is invalid.");
  }
  if (request.maxResults < 1 || request.maxResults > 8) {
    throw new SearchProviderError("invalid_query", "Search result limit is invalid.");
  }
}

function pruneCache() {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (value.expiresAt <= now) cache.delete(key);
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}
