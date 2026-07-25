import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the KMM dashboard app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="th"/i);
  assert.match(html, /<title>KMM Executive Dashboard \| H1 2026<\/title>/i);
  assert.match(html, /KMM executive sales, booking, revenue, branch and inventory performance dashboard for H1 2026\./);
  assert.match(html, /<link rel="(?:shortcut )?icon" href="\/kmm-logo\.png"/);
  assert.match(html, /<div class="grid min-h-screen place-items-center bg-\[#F8FAFC\]"/);
  assert.match(html, /border-t-\[#FF8615\]/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps starter preview scaffolding removed from the KMM app", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /HomeRedirect/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview|_sites-preview/i);
  assert.match(layout, /title:\s*"KMM Executive Dashboard \| H1 2026"/);
  assert.match(layout, /LocaleProvider/);
  assert.match(layout, /PresentationLayout/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|themeColor|\bViewport\b/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(previewRoot),
  );
  await assert.rejects(
    access(new URL("public/_sites-preview", templateRoot)),
  );
});
