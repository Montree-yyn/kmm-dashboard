import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Settings route preserves authentication and mounts the control center", async () => {
  const [route, shell] = await Promise.all([
    read("app/settings/page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);

  assert.match(route, /<SettingsControlCenter\s*\/>/);
  assert.match(shell, /<AuthGate>/);
  assert.doesNotMatch(route, /PlaceholderPage/);
});

test("Settings MVP is composed from the required reusable components", async () => {
  const [page, shell, header] = await Promise.all([
    read("components/settings/settings-page.tsx"),
    read("components/layout/global-app-shell.tsx"),
    read("components/layout/global-header.tsx"),
  ]);

  for (const component of ["SettingsCard", "SettingsSearch"]) {
    assert.match(page, new RegExp(`<${component}\\b`));
  }
  assert.match(shell, /<AppSidebar/);
  await Promise.all([
    read("components/settings/settings-card.tsx"),
    read("components/settings/settings-search.tsx"),
  ]);
  assert.match(header, /<KaiHeaderAssistant/);
});

test("Settings displays exactly the eight approved categories", async () => {
  const page = await read("components/settings/settings-page.tsx");
  const titles = [
    "Company Management",
    "User Management",
    "Roles & Permissions",
    "AI Settings",
    "Dashboard Settings",
    "Theme & Language",
    "Backup",
    "Audit Log",
  ];

  assert.equal((page.match(/\bid: "/g) ?? []).length, 8);
  for (const title of titles) {
    assert.ok(page.includes(`title: "${title}"`));
  }
  assert.match(page, /description: \["Company profile", "Branch", "Department", "Fiscal Year"\]/);
  assert.match(page, /description: \["AI Model", "Memory", "Prompt", "Agent"\]/);
  assert.match(page, /description: \["Automatic Backup", "Restore", "Schedule"\]/);
});

test("Settings cards are selectable, active, and keyboard accessible", async () => {
  const card = await read("components/settings/settings-card.tsx");

  assert.match(card, /type="button"/);
  assert.match(card, /aria-pressed=\{selected\}/);
  assert.match(card, /aria-label=\{`\$\{t\("settings\.open"\)\} \$\{item\.title\}`\}/);
  assert.match(card, /onClick=\{\(\) => onSelect\(item\)\}/);
  assert.match(card, /t\("settings\.active"\)/);
  assert.match(card, /focus-visible:ring-2/);
  assert.match(card, /hover:-translate-y-1/);
  assert.match(card, /hover:scale-\[1\.01\]/);
  assert.match(card, /duration-150/);
});

test("Settings search filters cards without competing for the KAI shortcut", async () => {
  const [page, search] = await Promise.all([
    read("components/settings/settings-page.tsx"),
    read("components/settings/settings-search.tsx"),
  ]);

  assert.doesNotMatch(page, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(page, /\.includes\(normalized\)/);
  assert.match(page, /t\("settings\.noResults"\)/);
  assert.match(page, /localizedCards/);
  assert.match(search, /placeholder=\{t\("settings\.searchPlaceholder"\)\}/);
  assert.match(search, /aria-label=\{t\("settings\.searchLabel"\)\}/);
  assert.doesNotMatch(search, /⌘K/);
});

test("Settings sidebar contains the approved Phase 1 menu and company area", async () => {
  const [sidebar, navigation] = await Promise.all([
    read("components/navigation/app-sidebar.tsx"),
    read("components/navigation/navigation-config.ts"),
  ]);

  for (const label of [
    "Home",
    "Dashboard",
    "Sales",
    "Booking",
    "Stock",
    "Customer",
    "Marketing",
    "Report",
    "AI",
    "Settings",
  ]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }
  assert.match(sidebar, /selectedCompany\?\.name \?\? "Company"/);
  assert.match(sidebar, /t\("company\.current"\)/);
  assert.match(sidebar, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(navigation, /visible: false/);
});

test("Settings uses the global accessible KAI header assistant", async () => {
  const panel = await read("components/kai/kai-header-assistant.tsx");

  assert.match(panel, /AI Assistant/);
  assert.match(panel, /Kubota Artificial Intelligence/);
  assert.match(panel, /Configure Company/);
  assert.match(panel, /Create Branch/);
  assert.match(panel, /Recent Suggestions/);
  assert.match(panel, /No current suggestions/);
  assert.match(panel, /Open KAI Assistant/);
  assert.match(panel, /Close KAI Assistant/);
  assert.match(panel, /event\.key === "Escape"/);
  assert.match(panel, /event\.key !== "Tab"/);
  assert.match(panel, /event\.metaKey \|\| event\.ctrlKey/);
  assert.doesNotMatch(panel, /hasNewSuggestion|rounded-full.*status-danger/);
});

test("Settings keeps Phase 2 modules out of the MVP", async () => {
  const sources = await Promise.all([
    read("components/settings/settings-page.tsx"),
    read("components/settings/settings-card.tsx"),
    read("components/kai/kai-header-assistant.tsx"),
  ]);
  const combined = sources.join("\n");

  for (const prohibited of [
    "Plugin",
    "Integration",
    "License",
    "Marketplace",
    "Data Governance",
    "SMTP",
    "Feature Toggle",
    "Maintenance",
    "System Logs",
  ]) {
    assert.doesNotMatch(combined, new RegExp(prohibited, "i"));
  }
  assert.doesNotMatch(combined, /\bfetch\s*\(/);
});

test("Settings follows the responsive control-center layout", async () => {
  const page = await read("components/settings/settings-page.tsx");
  const header = await read("components/layout/global-header.tsx");

  assert.match(page, /kmm-settings-page min-h-\[calc\(100vh-72px\)\]/);
  assert.match(page, /sm:grid-cols-2 xl:grid-cols-4/);
  assert.match(page, /t\("settings\.overview"\)/);
  assert.match(page, /t\("settings\.overviewDescription"\)/);
  assert.match(header, /h-\[72px\]/);
  assert.match(header, /subtitle: "route\.settings\.subtitle"/);
  assert.match(header, /focus-visible:ring-2/);
});
