import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

// Rendering imports the Firebase client but does not authenticate. Provide a
// structurally valid, non-secret config so this test is hermetic in a clean
// release worktree and never depends on a developer's ignored .env.local.
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "AIzaSyA12345678901234567890123456789012";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "kmm-render-test.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "kmm-render-test";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "kmm-render-test.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "123456789012";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123456789012:web:rendercheck";

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

test("serves the local KMM logo directly without the unavailable vinext image optimizer", async () => {
  const [login, authGate, sidebar] = await Promise.all([
    readFile(new URL("../components/auth/login-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/auth/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/navigation/app-sidebar.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [login, authGate, sidebar]) {
    assert.match(source, /<Image[\s\S]*?unoptimized/);
  }
});

test("keeps the KMM Design System v3.3 foundation and V3.5 analysis contract semantic", async () => {
  const [globalStyles, layout, designSystem] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../DESIGN.md", import.meta.url), "utf8"),
  ]);

  assert.match(globalStyles, /--brand-500:\s*#ff7a00/i);
  assert.match(globalStyles, /--surface-canvas:\s*#f7f8fa/i);
  assert.match(globalStyles, /--text-primary:\s*#1f2937/i);
  assert.match(globalStyles, /--radius-card:\s*14px/i);
  assert.match(globalStyles, /--motion-standard:\s*200ms/i);
  assert.match(globalStyles, /--font-heading:[\s\S]*?"Plus Jakarta Sans Variable"/i);
  assert.match(globalStyles, /--font-body:[\s\S]*?"Inter Variable"/i);
  assert.match(globalStyles, /--font-kmm:\s*var\(--font-body\)/i);
  assert.match(globalStyles, /:where\(h1, h2, h3, h4, h5, h6, \[role="heading"\]\)/i);
  assert.match(globalStyles, /\.kmm-glass-bar/);
  assert.match(globalStyles, /\.kmm-glass-control/);
  assert.match(globalStyles, /\.kmm-tabular/);
  assert.match(layout, /@fontsource-variable\/plus-jakarta-sans/);
  assert.match(layout, /@fontsource-variable\/inter/);
  assert.match(layout, /@fontsource\/ibm-plex-sans-thai\/thai-/);
  assert.match(layout, /KMM-V3\.3-SELECTIVE-GLASS-20260811/);
  assert.match(designSystem, /KMM Dashboard Design V3\.5/);
  assert.match(designSystem, /single-company views/i);
});
