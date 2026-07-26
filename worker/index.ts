/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS?: Fetcher;
  DB: D1Database;
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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === PMTILES_PATH) {
      return serveRangeAsset(request, env);
    }

    if (url.pathname === BASEMAP_PMTILES_PATH) {
      return serveRemoteBasemapPmtiles(request);
    }

    if (url.pathname === "/_vinext/image") {
      if (!env?.ASSETS) return new Response("Static asset binding unavailable", { status: 503 });
      const assets = env.ASSETS;
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => assets.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
