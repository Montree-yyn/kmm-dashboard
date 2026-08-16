import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { ClientDataLayer } = await tsImport("../lib/client-data-layer.ts", import.meta.url);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("deduplicates concurrent identical requests into one fetch", async () => {
  const layer = new ClientDataLayer(30_000);
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    await delay(10);
    return { value: calls };
  };
  const [a, b, c] = await Promise.all([
    layer.request("key", fetcher),
    layer.request("key", fetcher),
    layer.request("key", fetcher),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.value, 1);
  assert.equal(b.value, 1);
  assert.equal(c.value, 1);
  assert.equal(a, b);
  assert.equal(b, c);
});

test("reuses a resolved payload within the TTL window", async () => {
  const layer = new ClientDataLayer(1_000);
  let calls = 0;
  const fetcher = async () => ({ value: ++calls });
  await layer.request("key", fetcher);
  await layer.request("key", fetcher);
  assert.equal(calls, 1);
});

test("expires the cache after the TTL elapses", async () => {
  const layer = new ClientDataLayer(20);
  let calls = 0;
  const fetcher = async () => ({ value: ++calls });
  await layer.request("key", fetcher);
  await delay(40);
  await layer.request("key", fetcher);
  assert.equal(calls, 2);
});

test("force bypasses the TTL cache (explicit user refresh)", async () => {
  const layer = new ClientDataLayer(30_000);
  let calls = 0;
  const fetcher = async () => ({ value: ++calls });
  await layer.request("key", fetcher);
  await layer.request("key", fetcher, { force: true });
  assert.equal(calls, 2);
});

test("errors are never cached so a retry always re-fetches", async () => {
  const layer = new ClientDataLayer(30_000);
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) throw new Error("boom");
    return { value: calls };
  };
  await assert.rejects(() => layer.request("key", fetcher), /boom/);
  const result = await layer.request("key", fetcher);
  assert.equal(result.value, 2);
  assert.equal(calls, 2);
});

test("invalidate and invalidatePrefix drop cached entries", async () => {
  const layer = new ClientDataLayer(30_000);
  let calls = 0;
  const fetcher = async () => ({ value: ++calls });
  await layer.request("sales:kmm", fetcher);
  await layer.request("operations:kmm", fetcher);

  layer.invalidate("sales:kmm");
  await layer.request("sales:kmm", fetcher);
  assert.equal(calls, 3);

  layer.invalidatePrefix("operations:");
  await layer.request("operations:kmm", fetcher);
  assert.equal(calls, 4);
});

test("clear drops every cached entry", async () => {
  const layer = new ClientDataLayer(30_000);
  let calls = 0;
  const fetcher = async () => ({ value: ++calls });
  await layer.request("a", fetcher);
  await layer.request("b", fetcher);
  layer.clear();
  await layer.request("a", fetcher);
  await layer.request("b", fetcher);
  assert.equal(calls, 4);
  assert.equal(layer.size, 2);
});

test("kmm:sales-imported invalidates sales and operations prefixes", async () => {
  const listeners = {};
  const previousWindow = globalThis.window;
  globalThis.window = {
    addEventListener: (name, fn) => {
      (listeners[name] ??= []).push(fn);
    },
    removeEventListener: () => {},
  };
  try {
    const layer = new ClientDataLayer(30_000);
    let calls = 0;
    const fetcher = async () => ({ value: ++calls });
    await layer.request("sales:kmm", fetcher);
    await layer.request("operations:kmm", fetcher);
    await layer.request("agriculture:overview:kmm:", fetcher);

    for (const fn of listeners["kmm:sales-imported"] ?? []) fn();
    await layer.request("sales:kmm", fetcher);
    await layer.request("operations:kmm", fetcher);
    // Agriculture is untouched by the sales import event (still cached): the
    // third request must NOT add another fetch beyond the sales+ops refetch.
    await layer.request("agriculture:overview:kmm:", fetcher);
    assert.equal(calls, 5);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("kmm:company-changed clears every cached entry", async () => {
  const listeners = {};
  const previousWindow = globalThis.window;
  globalThis.window = {
    addEventListener: (name, fn) => {
      (listeners[name] ??= []).push(fn);
    },
    removeEventListener: () => {},
  };
  try {
    const layer = new ClientDataLayer(30_000);
    let calls = 0;
    const fetcher = async () => ({ value: ++calls });
    await layer.request("sales:old", fetcher);
    await layer.request("weather", fetcher);

    for (const fn of listeners["kmm:company-changed"] ?? []) fn();
    await layer.request("sales:old", fetcher);
    await layer.request("weather", fetcher);
    assert.equal(calls, 4);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
