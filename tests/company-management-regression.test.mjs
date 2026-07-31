import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Company Management route remains behind the existing AuthGate", async () => {
  const [route, shell] = await Promise.all([
    read("app/settings/company/page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);
  assert.match(shell, /<AuthGate>/);
  assert.match(shell, /pathname\.startsWith\(`\$\{prefix\}\/`\)/);
  assert.match(route, /<CompanyManagementPage\s*\/>/);
});

test("Company card opens the real Company Management route", async () => {
  const page = await read("components/settings/settings-page.tsx");
  assert.match(page, /router\.push\("\/settings\/company"\)/);
  assert.match(page, /item\.id === "company"/);
});

test("Company Management exposes exactly the eight approved sections", async () => {
  const navigation = await read(
    "components/settings/company/company-navigation.tsx",
  );
  for (const label of [
    "Overview",
    "General Information",
    "Branches",
    "Departments",
    "Fiscal Year",
    "Currency",
    "Language & Time Zone",
    "Working Calendar",
  ]) {
    assert.ok(navigation.includes(`label: "${label}"`));
  }
  assert.equal((navigation.match(/\{ id: "/g) ?? []).length, 8);
});

test("D1 schema contains all Phase 1 entities and ownership metadata", async () => {
  const schema = await read("db/schema.ts");
  for (const entity of [
    "companies",
    "branches",
    "departments",
    "fiscalYears",
    "companyCurrencies",
    "companyLocalizations",
    "workingCalendars",
    "holidays",
    "companySettingDrafts",
    "auditLogs",
  ]) {
    assert.match(schema, new RegExp(`export const ${entity} = sqliteTable`));
  }
  for (const field of [
    "tenantId",
    "companyId",
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy",
    "status",
  ]) {
    assert.match(schema, new RegExp(`${field}:`));
  }
});

test("Worker API verifies Firebase tokens and enforces permissions server-side", async () => {
  const [route, service, auth, permissions] = await Promise.all([
    read("app/api/company-management/route.ts"),
    read("lib/server/company-management-service.ts"),
    read("lib/server/firebase-auth.ts"),
    read("lib/company-management/permissions.ts"),
  ]);
  assert.match(route, /saveCompanyDraft/);
  assert.match(route, /publishCompanyDraft/);
  assert.match(auth, /crypto\.subtle\.verify/);
  assert.match(auth, /securetoken\.google\.com/);
  assert.match(service, /ROLE_PERMISSIONS\[context\.role\]\.edit/);
  assert.match(service, /ROLE_PERMISSIONS\[context\.role\]\.publish/);
  assert.match(service, /enforceStatusPermissions/);
  for (const role of ["super_admin", "company_admin", "manager", "viewer"]) {
    assert.match(permissions, new RegExp(`${role}:`));
  }
});

test("Draft and published configuration use separate persistence states", async () => {
  const [service, schema, page] = await Promise.all([
    read("lib/server/company-management-service.ts"),
    read("db/schema.ts"),
    read("components/settings/company/company-management-page.tsx"),
  ]);
  assert.match(schema, /company_setting_drafts/);
  assert.match(service, /status: "draft"/);
  assert.match(service, /status: "published"/);
  assert.match(page, /beforeunload/);
  assert.match(page, /Summary of Changes/);
  assert.match(page, /Confirm Publish/);
  assert.match(page, /normalizeForComparison/);
  assert.match(page, /left\.id\.localeCompare\(right\.id\)/);
});

test("General Information validates required, unique-format, email, URL, year, and logo rules", async () => {
  const [validation, client, general] = await Promise.all([
    read("lib/company-management/validation.ts"),
    read("lib/company-management/client.ts"),
    read("components/settings/company/company-general-information.tsx"),
  ]);
  assert.match(validation, /Company Name is required/);
  assert.match(validation, /Company Code is required/);
  assert.match(validation, /uppercase letters/);
  assert.match(validation, /valid email address/);
  assert.match(validation, /valid http or https URL/);
  assert.match(validation, /between 1800/);
  assert.match(client, /5 \* 1024 \* 1024/);
  assert.match(client, /image\/png/);
  assert.match(client, /firebase\/storage/);
  assert.match(general, /Upload Logo/);
  assert.match(general, /Replace Logo/);
  assert.match(general, /Remove Logo/);
});

test("Branch and Department draft CRUD preserves disable/reactivate semantics", async () => {
  const [branches, departments] = await Promise.all([
    read("components/settings/company/company-branches.tsx"),
    read("components/settings/company/company-departments.tsx"),
  ]);
  for (const term of [
    "Add Branch",
    "Edit Branch",
    "Branch Details",
    "Search branches",
    "Filter branches by status",
    "Sort branches",
    "Previous",
    "Next",
  ]) {
    assert.match(branches, new RegExp(term));
  }
  assert.match(branches, /hasTransactions/);
  assert.doesNotMatch(branches, /delete\(branch/i);
  for (const term of [
    "Add Department",
    "Edit Department",
    "Search departments",
    "Filter departments by branch",
  ]) {
    assert.match(departments, new RegExp(term));
  }
  assert.match(branches, /"disabled"/);
  assert.match(departments, /"disabled"/);
});

test("Fiscal, currency, localization, and calendar remain structured Phase 1 forms", async () => {
  const [configuration, localization] = await Promise.all([
    read("components/settings/company/company-configuration.tsx"),
    read("lib/company-management/localization.ts"),
  ]);
  assert.match(configuration, /Fiscal Year/);
  assert.match(configuration, /Manual Exchange Rate/);
  assert.match(configuration, /Exchange Rate Source/);
  assert.doesNotMatch(configuration, /\bfetch\s*\(/);
  for (const code of ["MMK", "THB", "USD"]) {
    assert.match(configuration, new RegExp(`value="${code}"`));
  }
  for (const code of ["th", "en", "my"]) {
    assert.match(localization, new RegExp(`code: "${code}"`));
  }
  for (const zone of ["Asia/Yangon", "Asia/Bangkok", "UTC"]) {
    assert.match(localization, new RegExp(zone.replace("/", "\\/")));
  }
  assert.match(configuration, /Repeat Annually/);
  assert.match(configuration, /All branches/);
});

test("Audit Log records every approved Company Management event family", async () => {
  const service = await read("lib/server/company-management-service.ts");
  for (const action of [
    "company.viewed",
    "company.draft_saved",
    "company.published",
    "company.logo_uploaded",
    "company.logo_removed",
    "branch.created",
    "branch.updated",
    "branch.disabled",
    "branch.reactivated",
    "department.created",
    "department.updated",
    "department.disabled",
    "fiscal_year.updated",
    "currency.updated",
    "localization.updated",
    "calendar.updated",
  ]) {
    assert.match(service, new RegExp(action.replace(".", "\\.")));
  }
});

test("KAI is integrated into the header and the legacy floating entry is removed", async () => {
  const [settings, header, kai] = await Promise.all([
    read("components/settings/settings-page.tsx"),
    read("components/layout/global-header.tsx"),
    read("components/kai/kai-header-assistant.tsx"),
  ]);
  const combined = `${settings}\n${header}\n${kai}`;
  assert.doesNotMatch(combined, /MYRO/i);
  assert.doesNotMatch(settings, /SettingsBanner/);
  assert.match(header, /<KaiHeaderAssistant/);
  assert.match(kai, /Open KAI Assistant/);
  assert.match(kai, /h-10/);
  assert.match(kai, /rounded-\[20px\]/);
  assert.doesNotMatch(kai, /fixed bottom-|hasNewSuggestion|notification/i);
});

test("Company Management is responsive, accessible, and supplies required states", async () => {
  const [page, navigation, controls, actions] = await Promise.all([
    read("components/settings/company/company-management-page.tsx"),
    read("components/settings/company/company-navigation.tsx"),
    read("components/settings/company/company-form-controls.tsx"),
    read("components/settings/company/company-action-bar.tsx"),
  ]);
  assert.match(page, /Loading Company Management/);
  assert.match(page, /Company Management is unavailable/);
  assert.match(page, /View-only access/);
  assert.match(actions, /Unsaved changes/);
  assert.match(page, /role=\{toast\.tone === "error" \? "alert" : "status"\}/);
  assert.match(navigation, /lg:hidden/);
  assert.match(navigation, /hidden.*lg:block/);
  assert.match(controls, /focus-visible:ring-2/);
  assert.match(controls, /role="switch"/);
  assert.match(controls, /disabled:cursor-not-allowed/);
});
