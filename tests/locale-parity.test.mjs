import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const load = (path) => tsImport(`../${path}`, import.meta.url).then((mod) => mod.default);

test("Thai and English locales expose the exact same key set", async () => {
  const [en, th] = await Promise.all([
    load("src/locales/en.ts"),
    load("src/locales/th.ts"),
  ]);
  assert.deepEqual(Object.keys(th).sort(), Object.keys(en).sort());
});

test("Myanmar locale defines every key explicitly — no silent English fallback", async () => {
  const [en, my] = await Promise.all([
    load("src/locales/en.ts"),
    load("src/locales/my.ts"),
  ]);
  assert.deepEqual(Object.keys(my).sort(), Object.keys(en).sort());
  // my.ts must not spread `en` as a fallback: a missing key has to be a
  // compile-time error, never a silent English value.
  const source = await read("src/locales/my.ts");
  assert.doesNotMatch(source, /^\s*\.\.\.en,?$/m, "my.ts must not spread en as a fallback");
  // Every key is spelled out explicitly in the file.
  const explicitKeys = source.match(/^\s{2}"[^"]+":\s*"/gm) ?? [];
  assert.equal(explicitKeys.length, Object.keys(en).length);
  // Exactly the previously-missing keys (178) carry the Thai placeholder
  // marker pending a Myanmar-speaking owner's review.
  const placeholderLines = source.match(/^\s{2}".*\/\/ TODO\(my\)$/gm) ?? [];
  assert.equal(placeholderLines.length, 178);
});

test("Every locale value is a non-empty string", async () => {
  const [en, th, my] = await Promise.all([
    load("src/locales/en.ts"),
    load("src/locales/th.ts"),
    load("src/locales/my.ts"),
  ]);
  for (const [name, dict] of [["en", en], ["th", th], ["my", my]]) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, "string", `${name}.${key} must be a string`);
      assert.ok(value.length > 0, `${name}.${key} must not be empty`);
    }
  }
});

test("translate() resolves every key in every language without falling back to the raw key", async () => {
  const { translate, locales } = await tsImport("../src/locales/index.ts", import.meta.url);
  const en = await load("src/locales/en.ts");
  for (const language of Object.keys(locales)) {
    for (const key of Object.keys(en)) {
      assert.notEqual(translate(language, key), key, `${language}.${key} resolved to the raw key`);
    }
  }
});
