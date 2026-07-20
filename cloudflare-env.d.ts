declare type Fetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

declare type D1Database = unknown;
declare type D1Result = unknown;

declare module "cloudflare:workers" {
  export const env: { DB?: D1Database };
}
