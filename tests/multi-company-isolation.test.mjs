import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const context = await tsImport("../lib/server/company-context.ts", import.meta.url);
const companyTypes = await tsImport("../lib/company-management/types.ts", import.meta.url);
const stockSelectors = await tsImport("../lib/dashboard/stock-selectors.ts", import.meta.url);

const companies = [
  { id: "kmm-company", tenantId: "kmm", code: "KMM", name: "KMM Company", role: "super_admin" },
  { id: "km-company", tenantId: "km", code: "KM", name: "Kubota Maesod", role: "manager" },
];

test("company selection is deterministic and rejects unauthorized or disabled multi-company access", () => {
  assert.equal(context.requestedCompanyId(new Request("https://dashboard.example/api/sales")), "kmm-company");
  assert.equal(context.requestedCompanyId(new Request("https://dashboard.example/api/sales?companyId=km-company")), "km-company");
  assert.equal(context.requestedCompanyId(new Request("https://dashboard.example/api/sales?companyId=kmm-company", { headers: { "X-Company-Id": "km-company" } })), "km-company");
  assert.equal(context.requestedCompanyId(new Request("https://dashboard.example/api/sales?companyId=kmm-company"), "km-company"), "km-company");
  assert.throws(() => context.requestedCompanyId(new Request("https://dashboard.example/api/sales?companyId=../../other")), { status: 400 });

  assert.equal(context.selectAuthorizedCompany(companies, "kmm-company", false).id, "kmm-company");
  assert.equal(context.selectAuthorizedCompany(companies, "km-company", true).id, "km-company");
  assert.throws(() => context.selectAuthorizedCompany(companies, "km-company", false), { status: 403 });
  assert.throws(() => context.selectAuthorizedCompany(companies.slice(0, 1), "km-company", true), { status: 403 });
});

test("KM and KMM defaults stay company-specific", () => {
  assert.equal(companyTypes.DEFAULT_COMPANY_SNAPSHOT.currency.primaryCurrency, "MMK");
  assert.equal(companyTypes.DEFAULT_COMPANY_SNAPSHOT.localization.defaultTimeZone, "Asia/Yangon");
  assert.equal(companyTypes.DEFAULT_KM_COMPANY_SNAPSHOT.currency.primaryCurrency, "THB");
  assert.equal(companyTypes.DEFAULT_KM_COMPANY_SNAPSHOT.localization.defaultTimeZone, "Asia/Bangkok");
  assert.notEqual(companyTypes.DEFAULT_COMPANY_SNAPSHOT.currency.id, companyTypes.DEFAULT_KM_COMPANY_SNAPSHOT.currency.id);
});

test("Stock keeps KMM's ownership rule without rejecting isolated KM free stock", () => {
  const base = {
    currentStatus: "FREE STOCK",
    productType: "TT",
    model: "M7040",
    chassisNumber: "CH-001",
  };
  assert.equal(stockSelectors.getCurrentStockRows([
    { ...base, companyId: companyTypes.COMPANY_ID, kmm: null },
  ]).length, 0);
  assert.equal(stockSelectors.getCurrentStockRows([
    { ...base, companyId: "km-company", kmm: null },
  ]).length, 1);
});

test("every operational API resolves company access before company-scoped reads or writes", async () => {
  const [sales, operations, salesImport, moduleImport, daily, dailyInput, kai] = await Promise.all([
    read("app/api/sales/route.ts"),
    read("app/api/operations/route.ts"),
    read("app/api/data-hub/sales/route.ts"),
    read("app/api/data-hub/import/route.ts"),
    read("app/api/daily-management/route.ts"),
    read("app/api/daily-management/input/route.ts"),
    read("app/api/kai/chat/route.ts"),
  ]);
  for (const route of [sales, operations, salesImport, moduleImport]) {
    assert.match(route, /requireCompanyContext/);
  }
  assert.match(sales, /listSalesTransactions\(companyId\)/);
  assert.match(operations, /listBookingTransactions\(context\.id\)/);
  assert.match(operations, /listStockTransactions\(context\.id\)/);
  assert.match(salesImport, /permission: "edit"/);
  assert.match(salesImport, /const companyId = context\.id/);
  assert.match(salesImport, /delete\(salesTransactions\)\.where\(eq\(salesTransactions\.companyId, companyId\)\)/);
  assert.match(moduleImport, /companyId: context\.id/);
  assert.match(moduleImport, /bookingTransactions\.companyId, context\.id/);
  assert.match(moduleImport, /stockTransactions\.companyId, context\.id/);
  assert.match(daily, /listSalesTransactions\(access\.id\)/);
  assert.match(dailyInput, /dailyManagementInputs\.companyId, access\.id/);
  assert.match(kai, /resolveKaiBusinessAccess\(user, request, input\.companyId\)/);
});

test("repositories require an explicit company id and Company Management never auto-provisions membership", async () => {
  const [salesRepository, operationsRepository, companyService] = await Promise.all([
    read("lib/sales/repository.ts"),
    read("lib/operations/repository.ts"),
    read("lib/server/company-management-service.ts"),
  ]);
  assert.match(salesRepository, /listSalesTransactions\(companyId: string\)/);
  assert.match(salesRepository, /listSalespeople\(companyId: string\)/);
  assert.match(operationsRepository, /listBookingTransactions\(companyId: string\)/);
  assert.match(operationsRepository, /listStockTransactions\(companyId: string\)/);
  assert.doesNotMatch(`${salesRepository}\n${operationsRepository}`, /COMPANY_ID/);
  assert.match(companyService, /requireCompanyContext\(request/);
  assert.match(companyService, /includeDisabledCompany: true/);
  assert.doesNotMatch(companyService, /insert\(companyUsers\)/);
  assert.match(companyService, /enforceCompanyIdentity/);
});

test("client fallback and company switching cannot cross company boundaries", async () => {
  const [salesClient, operationsClient, provider, shell, header] = await Promise.all([
    read("lib/sales/client.ts"),
    read("lib/operations/client.ts"),
    read("src/context/CompanyContext.tsx"),
    read("components/layout/global-app-shell.tsx"),
    read("components/layout/global-header.tsx"),
  ]);
  for (const client of [salesClient, operationsClient]) {
    assert.match(client, /companyId && companyId !== COMPANY_ID/);
  }
  assert.match(provider, /url\.searchParams\.set\("companyId", next\.id\)/);
  assert.match(shell, /<div key=\{selectedCompany\.id\}>/);
  assert.match(header, /<KaiHeaderAssistant key=\{selectedCompany\?\.id \?\? "company"\}/);
});

test("KMM-only modules are hidden and guarded when KM is active", async () => {
  const [types, sidebar, marketing, expense, guard] = await Promise.all([
    read("lib/company-context/types.ts"),
    read("components/navigation/app-sidebar.tsx"),
    read("app/marketing/page.tsx"),
    read("app/expense/page.tsx"),
    read("components/company/company-module-guard.tsx"),
  ]);
  assert.match(types, /marketing: hasVerifiedKmmOnlySource/);
  assert.match(types, /expense: hasVerifiedKmmOnlySource/);
  assert.match(sidebar, /selectedCompany\?\.capabilities\.marketing/);
  assert.match(sidebar, /selectedCompany\?\.capabilities\.expense/);
  assert.match(marketing, /module="marketing"/);
  assert.match(expense, /module="expense"/);
  assert.match(guard, /cannot be shown under the wrong company/);
});

test("KAI uses the selected company's currency and timezone for shared aggregates", async () => {
  const [access, business] = await Promise.all([
    read("lib/kai/business/access-context.ts"),
    read("lib/kai/tools/kmm-business.ts"),
  ]);
  assert.match(access, /currency: context\.currency/);
  assert.match(access, /timeZone: context\.timeZone/);
  assert.match(business, /resolveKmmDateRange\(context\.message, context\.now, timeZone\)/);
  assert.match(business, /formatBusinessAnswer\(context\.message, data, companyCode, context\.businessAccess\.currency\)/);
});

test("staging enables single-company switching and KM onboarding while production remains KMM-locked", async () => {
  const [staging, production, smartImport, switcher, salesImport, moduleImport, branchGate, migration] = await Promise.all([
    read("wrangler.staging.jsonc"),
    read("wrangler.json"),
    read("components/data-hub/smart-import-center.tsx"),
    read("components/company/company-switcher.tsx"),
    read("app/api/data-hub/sales/route.ts"),
    read("app/api/data-hub/import/route.ts"),
    read("lib/server/import-branch-validation.ts"),
    read("drizzle/0011_sweet_black_bird.sql"),
  ]);
  assert.match(staging, /"MULTI_COMPANY_ENABLED": "true"/);
  assert.doesNotMatch(production, /MULTI_COMPANY_ENABLED/);
  assert.match(smartImport, /Active company/);
  assert.match(smartImport, /Data Onboarding/);
  assert.match(smartImport, /Branch Master required/);
  assert.match(smartImport, /Files can be selected and validated now, but D1 import stays locked/);
  assert.match(switcher, /Choose one company/);
  assert.doesNotMatch(`${smartImport}\n${switcher}`, /<option value="all">|All companies/);
  assert.match(salesImport, /assertImportBranches/);
  assert.match(moduleImport, /assertImportBranches/);
  assert.match(branchGate, /branches\.branchCode/);
  assert.match(branchGate, /branches\.branchName/);
  assert.match(migration, /companies_company_id_unique/);
});
