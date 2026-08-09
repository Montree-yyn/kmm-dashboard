import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global localization supports Thai, English and Myanmar with persistent selection", async () => {
  const [index, context, header, sidebar, english, thai, myanmar, css] = await Promise.all([
    read("src/locales/index.ts"),
    read("src/context/LocaleContext.tsx"),
    read("components/layout/global-header.tsx"),
    read("components/navigation/app-sidebar.tsx"),
    read("src/locales/en.ts"),
    read("src/locales/th.ts"),
    read("src/locales/my.ts"),
    read("app/globals.css"),
  ]);
  assert.match(index, /\{ th, en, my \}/);
  assert.match(index, /my-MM-u-nu-latn/);
  assert.match(context, /value === "my"/);
  assert.match(context, /document\.documentElement\.lang/);
  assert.match(context, /localStorage/);
  assert.match(header, /value="my"/);
  assert.match(header, /route\.dailyManagement\.title/);
  assert.match(sidebar, /item\.labelKey/);
  for (const locale of [english, thai, myanmar]) {
    assert.match(locale, /"language\.myanmar"/);
    assert.match(locale, /"nav\.dailyReport"/);
    assert.match(locale, /"route\.booking\.title"/);
    assert.match(locale, /"daily\.publishReport"/);
  }
  assert.match(css, /Noto Sans Myanmar/);
  assert.match(css, /data-locale="my"/);
});

test("primary application surfaces use the shared locale layer", async () => {
  const paths = [
    "components/auth/login-form.tsx",
    "components/dashboard/dashboard-page.tsx",
    "components/sales/sales-page.tsx",
    "components/booking/booking-intelligence-page.tsx",
    "components/stock/stock-intelligence-page.tsx",
    "components/team/sales-organization-page.tsx",
    "components/expense/expense-intelligence-page.tsx",
    "components/data-hub/smart-import-center.tsx",
    "components/settings/settings-page.tsx",
    "components/daily-management/daily-management-page.tsx",
    "components/daily-management/daily-management-input-page.tsx",
  ];
  const sources = await Promise.all(paths.map(read));
  sources.forEach((source, index) => assert.match(source, /useLocale/, paths[index]));
});
