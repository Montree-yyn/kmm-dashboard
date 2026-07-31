import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the global KAI entry is header-native and contains no floating behavior", async () => {
  const [component, styles] = await Promise.all([
    read("components/kai/kai-header-assistant.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(component, /h-10/);
  assert.match(component, /px-3/);
  assert.match(component, /sm:px-4/);
  assert.match(component, /rounded-\[20px\]/);
  assert.match(component, /border-\[#E8E8E8\]/);
  assert.match(component, /duration-150/);
  assert.match(component, /<Sparkles/);
  assert.match(component, />\s*KAI\s*</);
  assert.doesNotMatch(component, /fixed bottom-|hasNewSuggestion|animate-pulse/i);
  assert.match(styles, /\.kmm-kai-panel/);
  assert.match(styles, /width: min\(420px, 100vw\)/);
  assert.match(styles, /width: min\(360px, 100vw\)/);
  assert.match(styles, /height: 80dvh/);
  assert.match(component, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /250ms ease/);
});

test("KAI panel supplies the approved enterprise content architecture", async () => {
  const component = await read("components/kai/kai-header-assistant.tsx");
  for (const label of [
    "Kubota Artificial Intelligence",
    "Online",
    "Configure Company",
    "Create Branch",
    "Invite User",
    "Check Permissions",
    "Explain Settings",
    "Search Documentation",
    "Recent Suggestions",
    "Global Search",
    "Settings",
    "Users",
    "Reports",
    "Dashboard",
    "Booking",
    "Stock",
    "Sales",
    "Customers",
    "AI Knowledge",
    "Conversation",
  ]) {
    assert.match(component, new RegExp(label));
  }
});

test("KAI keyboard and focus behavior is centralized and accessible", async () => {
  const component = await read("components/kai/kai-header-assistant.tsx");
  assert.match(component, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(component, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key !== "Tab"/);
  assert.match(component, /previousFocus\?\.focus\(\)/);
  assert.match(component, /aria-controls="kai-assistant-panel"/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /focus-visible:ring-2/);
});

test("the persistent global application header is the only KAI mount", async () => {
  const [header, shell] = await Promise.all([
    read("components/layout/global-header.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);
  assert.match(header, /<KaiHeaderAssistant/);
  assert.match(shell, /<GlobalHeader/);
  assert.match(shell, /data-global-app-shell/);
});

test("the removed Settings floating assistant cannot return accidentally", async () => {
  await assert.rejects(
    access(
      new URL(
        "../components/settings/kai-assistant.tsx",
        import.meta.url,
      ),
    ),
  );
});
