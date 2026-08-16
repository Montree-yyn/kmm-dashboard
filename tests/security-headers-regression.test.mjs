import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Worker applies the five hardening security headers to every response", async () => {
  const worker = await read("worker/index.ts");
  for (const header of [
    '"X-Frame-Options": "SAMEORIGIN"',
    '"Strict-Transport-Security": "max-age=31536000; includeSubDomains"',
    '"X-Content-Type-Options": "nosniff"',
    '"Referrer-Policy": "strict-origin-when-cross-origin"',
    '"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()"',
  ]) {
    assert.ok(worker.includes(header), `missing header entry: ${header}`);
  }
  assert.ok(worker.includes("if (!headers.has(name)) headers.set(name, value)"), "existing headers must not be overwritten");
});

test("Every worker path (pmtiles, basemap, image optimizer, app) flows through the security wrapper", async () => {
  const worker = await read("worker/index.ts");
  // The single wrapper is applied to the one response variable every branch
  // assigns to, so no response can bypass the headers.
  assert.match(worker, /return withSecurityHeaders\(response, env\);/);
  assert.match(worker, /response = await serveRangeAsset\(request, env\)/);
  assert.match(worker, /response = await serveRemoteBasemapPmtiles\(request\)/);
  assert.match(worker, /response = await handleImageOptimization/);
  assert.match(worker, /response = await handler\.fetch\(request, env, ctx\)/);
  assert.doesNotMatch(worker, /return serveRangeAsset\(request, env\)/);
  assert.doesNotMatch(worker, /return serveRemoteBasemapPmtiles\(request\)/);
  assert.doesNotMatch(worker, /return handler\.fetch\(request, env, ctx\)/);
  assert.doesNotMatch(worker, /return new Response\("Static asset binding unavailable"/);
});

test("CSP starts in report-only mode and stays environment-overridable", async () => {
  const worker = await read("worker/index.ts");
  assert.ok(worker.includes('"Content-Security-Policy-Report-Only"'), "report-only header must be set");
  assert.ok(worker.includes("CSP_REPORT_ONLY?: string"), "env binding must exist");
  assert.ok(worker.includes("CSP_REPORT_ONLY ?? DEFAULT_CSP_REPORT_ONLY"), "env override must take precedence");
  // The draft policy explicitly allows the app's known external surfaces so
  // staging reports surface real violations instead of expected ones.
  for (const host of [
    "api.open-meteo.com",
    "api.rainviewer.com",
    "tilecache.rainviewer.com",
    "protomaps.github.io",
    "identitytoolkit.googleapis.com",
    "securetoken.googleapis.com",
  ]) {
    assert.ok(worker.includes(host), `CSP draft must cover ${host}`);
  }
  assert.ok(worker.includes("worker-src 'self' blob:"), "MapLibre blob worker must be allowed");
  assert.ok(worker.includes("object-src 'none'"), "object-src must be locked down");
});
