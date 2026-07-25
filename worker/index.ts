/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
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

async function serveRangeAsset(request: Request, env: Env) {
  const assetRequest = new Request(new URL(PMTILES_PATH, request.url), { method: "GET" });
  const assetResponse = await env.ASSETS.fetch(assetRequest);
  if (!assetResponse.ok) return assetResponse;

  const body = await assetResponse.arrayBuffer();
  const total = body.byteLength;
  const range = request.headers.get("range");
  const headers = new Headers(assetResponse.headers);
  headers.set("accept-ranges", "bytes");
  headers.set("content-type", "application/octet-stream");

  if (!range) {
    headers.set("content-length", String(total));
    return new Response(body, { status: assetResponse.status, headers });
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

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
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
