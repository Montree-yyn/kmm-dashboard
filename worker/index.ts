/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS?: Fetcher;
  COMPANY_DB: D1Database;
  OPERATIONS_DB: D1Database;
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  KAI_MODEL?: string;
  KAI_PRIMARY_MODEL?: string;
  KAI_FALLBACK_MODEL?: string;
  KAI_MAX_TOKENS?: string;
  KAI_TEMPERATURE?: string;
  TAVILY_API_KEY?: string;
  /** Optional override for the report-only CSP value (e.g. "" to disable). */
  CSP_REPORT_ONLY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const PMTILES_PATH = "/maps/vector/myanmar-townships.pmtiles";
const BASEMAP_PMTILES_PATH = "/maps/vector/protomaps-osm-v4.pmtiles";
const BASEMAP_PMTILES_UPSTREAM = "https://data.source.coop/protomaps/openstreetmap/v4.pmtiles";

function servePmtilesBytes(body: ArrayBuffer, request: Request, inputHeaders?: Headers) {
  const total = body.byteLength;
  const range = request.headers.get("range");
  const headers = new Headers(inputHeaders);
  headers.set("accept-ranges", "bytes");
  headers.set("content-type", "application/octet-stream");

  if (!range) {
    headers.set("content-length", String(total));
    return new Response(body, { status: 200, headers });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new Response(null, { status: 416, headers: { "content-range": `bytes */${total}` } });

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= total) {
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${total}` } });
  }

  const cappedEnd = Math.min(end, total - 1);
  const chunk = body.slice(start, cappedEnd + 1);
  headers.set("content-length", String(chunk.byteLength));
  headers.set("content-range", `bytes ${start}-${cappedEnd}/${total}`);
  return new Response(chunk, { status: 206, headers });
}

async function serveLocalPmtilesAsset(request: Request) {
  const { readFile } = await import("node:fs/promises");
  const assetUrl = new URL("../client/maps/vector/myanmar-townships.pmtiles", import.meta.url);
  const body = await readFile(assetUrl);
  return servePmtilesBytes(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength), request);
}

async function serveRangeAsset(request: Request, env?: Env) {
  try {
    if (!env?.ASSETS) {
      return serveLocalPmtilesAsset(request);
    }

    const assetRequest = new Request(new URL(PMTILES_PATH, request.url), { method: "GET" });
    const assetResponse = await env.ASSETS.fetch(assetRequest);
    if (!assetResponse.ok) return assetResponse;

    const body = await assetResponse.arrayBuffer();
    return servePmtilesBytes(body, request, assetResponse.headers);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), { status: 500 });
  }
}

async function serveRemoteBasemapPmtiles(request: Request) {
  const upstreamHeaders = new Headers();
  const range = request.headers.get("range");
  const ifRange = request.headers.get("if-range");
  if (range) upstreamHeaders.set("range", range);
  if (ifRange) upstreamHeaders.set("if-range", ifRange);

  let upstreamResponse: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    upstreamResponse = await fetch(BASEMAP_PMTILES_UPSTREAM, { headers: upstreamHeaders });
    if (upstreamResponse.status < 500) break;
  }

  if (!upstreamResponse) return new Response("Basemap PMTiles upstream unavailable", { status: 502 });

  const headers = new Headers();
  [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ].forEach((name) => {
    const value = upstreamResponse?.headers.get(name);
    if (value) headers.set(name, value);
  });
  headers.set("access-control-allow-origin", new URL(request.url).origin);
  headers.set("vary", "Origin, Range");
  if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");

  return new Response(upstreamResponse.body, { status: upstreamResponse.status, statusText: upstreamResponse.statusText, headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

// Hardening headers applied to every response that leaves this worker
// (HTML, JSON APIs, image-optimizer output and binary PMTiles chunks).
// HSTS only takes effect over HTTPS — local dev on http://localhost is
// unaffected, per the HTTP specification.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

// Initial Content-Security-Policy-Report-Only baseline. Report-only never
// blocks the browser — it only sends violation reports — so the app keeps
// working while the policy is tuned from real traffic. Override per
// environment with the CSP_REPORT_ONLY binding ("" disables).
//
// Draft allowances reflect the app's known surfaces: Next.js inline
// bootstrap script + MapLibre blob worker ('unsafe-inline', blob:), inline
// chart/map styles, weather (Open-Meteo, RainViewer), Firebase token
// refresh (identitytoolkit/securetoken), and Protomaps glyph/sprite assets.
const DEFAULT_CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' blob:",
  "style-src 'self' 'unsafe-inline' blob:",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://tilecache.rainviewer.com https://protomaps.github.io",
  "font-src 'self' data:",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.open-meteo.com https://api.rainviewer.com https://protomaps.github.io",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function withSecurityHeaders(response: Response, env?: Env): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  const csp = env?.CSP_REPORT_ONLY ?? DEFAULT_CSP_REPORT_ONLY;
  if (csp) headers.set("Content-Security-Policy-Report-Only", csp);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;

    if (url.pathname === PMTILES_PATH) {
      response = await serveRangeAsset(request, env);
    } else if (url.pathname === BASEMAP_PMTILES_PATH) {
      response = await serveRemoteBasemapPmtiles(request);
    } else if (url.pathname === "/_vinext/image") {
      if (!env?.ASSETS) {
        response = new Response("Static asset binding unavailable", { status: 503 });
      } else {
        const assets = env.ASSETS;
        const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
        response = await handleImageOptimization(request, {
          fetchAsset: (path) => assets.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
            return result.response();
          },
        }, allowedWidths);
      }
    } else {
      response = await handler.fetch(request, env, ctx);
    }

    // Every response — HTML, JSON APIs, image-optimizer output and binary
    // PMTiles chunks — leaves the worker with the hardening headers applied.
    return withSecurityHeaders(response, env);
  },
};

export default worker;
