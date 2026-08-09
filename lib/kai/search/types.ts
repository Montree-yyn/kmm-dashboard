export type SearchTopic = "general" | "news";
export type SearchTimeRange = "day" | "week" | "month" | null;

export type SearchRequest = {
  query: string;
  topic: SearchTopic;
  timeRange: SearchTimeRange;
  maxResults: number;
  cacheTtlMs: number;
};

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt: string | null;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};

export interface SearchProvider {
  search(request: SearchRequest): Promise<SearchResponse>;
}

export class SearchProviderError extends Error {
  constructor(
    readonly code:
      | "unconfigured"
      | "invalid_query"
      | "timeout"
      | "quota"
      | "unavailable"
      | "invalid_response",
    message: string,
  ) {
    super(message);
  }
}
