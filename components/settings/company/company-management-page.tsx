"use client";

import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, ShieldAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  CompanyApiError,
  loadCompanyManagement,
  publishCompanyDraft,
  recordLogoAudit,
  saveCompanyDraft,
  uploadCompanyLogo,
} from "../../../lib/company-management/client";
import type {
  CompanyManagementResponse,
  CompanySection,
  CompanySettingsSnapshot,
} from "../../../lib/company-management/types";
import { DEFAULT_COMPANY_SNAPSHOT } from "../../../lib/company-management/types";
import {
  validateCompanySnapshot,
  type ValidationErrors,
} from "../../../lib/company-management/validation";
import { cn } from "../../../lib/utils";
import { SettingsSearch } from "../settings-search";
import { CompanyActionBar } from "./company-action-bar";
import { CompanyBranches } from "./company-branches";
import {
  CompanyCurrencySettings,
  CompanyFiscalYear,
  CompanyLocalizationSettings,
  CompanyWorkingCalendar,
} from "./company-configuration";
import { CompanyDepartments } from "./company-departments";
import { CompanyGeneralInformation } from "./company-general-information";
import {
  CompanyNavigation,
  companySections,
} from "./company-navigation";
import { CompanyOverview } from "./company-overview";
import { PageHeader } from "../../design-system/page-header";
import { useCompany } from "../../../src/hooks/useCompany";

type ToastState = {
  tone: "success" | "error";
  message: string;
};

export function CompanyManagementPage() {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] =
    useState<CompanySection>("overview");
  const [data, setData] = useState<CompanyManagementResponse | null>(null);
  const [draft, setDraft] = useState<CompanySettingsSnapshot>(
    structuredClone(DEFAULT_COMPANY_SNAPSHOT),
  );
  const [savedDraft, setSavedDraft] = useState<CompanySettingsSnapshot>(
    structuredClone(DEFAULT_COMPANY_SNAPSHOT),
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedDraft),
    [draft, savedDraft],
  );
  const changeSummary = useMemo(
    () => summarizeChanges(data?.published, draft),
    [data?.published, draft],
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    if (!nextQuery.trim()) return;
    const match = companySections.find((section) =>
      section.label.toLowerCase().includes(nextQuery.trim().toLowerCase()),
    );
    if (match) setActiveSection(match.id);
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await loadCompanyManagement(companyId);
      setData(response);
      setDraft(structuredClone(response.draft));
      setSavedDraft(structuredClone(response.draft));
      setErrors({});
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load Company Management.",
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function patchDraft(patch: Partial<CompanySettingsSnapshot>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSave(showSuccess = true) {
    const validation = validateCompanySnapshot(draft);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setToast({
        tone: "error",
        message: "Please correct the highlighted fields before saving.",
      });
      return null;
    }
    setSaving(true);
    try {
      const response = await saveCompanyDraft(draft, companyId);
      setData(response);
      setDraft(structuredClone(response.draft));
      setSavedDraft(structuredClone(response.draft));
      setErrors({});
      if (showSuccess) {
        setToast({ tone: "success", message: "Company draft saved." });
      }
      return response;
    } catch (error) {
      if (error instanceof CompanyApiError) setErrors(error.details);
      setToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to save the draft.",
      });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishOpen(false);
    setSaving(true);
    try {
      if (dirty) {
        const saved = await handleSave(false);
        if (!saved) return;
      }
      const response = await publishCompanyDraft(companyId);
      setData(response);
      setDraft(structuredClone(response.draft));
      setSavedDraft(structuredClone(response.draft));
      setToast({
        tone: "success",
        message: "Company settings published successfully.",
      });
    } catch (error) {
      if (error instanceof CompanyApiError) setErrors(error.details);
      setToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to publish Company settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const oldValue = draft.company.logoUrl;
      const logoUrl = await uploadCompanyLogo(file);
      patchDraft({
        company: { ...draft.company, logoUrl },
      });
      await recordLogoAudit("company.logo_uploaded", oldValue, logoUrl, companyId);
      setToast({
        tone: "success",
        message: "Logo uploaded. Save the draft to keep this change.",
      });
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Logo upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleLogoRemove() {
    const oldValue = draft.company.logoUrl;
    patchDraft({ company: { ...draft.company, logoUrl: "" } });
    try {
      await recordLogoAudit("company.logo_removed", oldValue, "", companyId);
    } catch (error) {
      setToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to record logo removal.",
      });
    }
  }

  function goBack() {
    if (dirty && !window.confirm("Leave without saving your Company changes?")) {
      return;
    }
    router.push("/settings");
  }

  if (loading) {
    return (
      <CompanyShell
        query={query}
        searchRef={searchRef}
        onQueryChange={handleQueryChange}
      >
        <div className="grid min-h-[60vh] place-items-center">
          <div className="text-center">
            <LoaderCircle
              size={32}
              className="mx-auto animate-spin text-[var(--brand-500)]"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
              Loading Company Management...
            </p>
          </div>
        </div>
      </CompanyShell>
    );
  }

  if (!data || loadError) {
    return (
      <CompanyShell
        query={query}
        searchRef={searchRef}
        onQueryChange={handleQueryChange}
      >
        <div className="grid min-h-[60vh] place-items-center text-center">
          <div className="max-w-md">
            <ShieldAlert
              size={34}
              className="mx-auto text-[var(--status-danger)]"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">
              Company Management is unavailable
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-5 min-h-11 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-sm font-semibold text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      </CompanyShell>
    );
  }

  const readOnly = !data.permissions.edit;

  return (
    <CompanyShell
      query={query}
      searchRef={searchRef}
      onQueryChange={handleQueryChange}
    >
      <main className="mx-auto max-w-[1480px] p-4 pb-0 sm:p-5 sm:pb-0 xl:p-6 xl:pb-0">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={goBack}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control-lg)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <ArrowLeft size={17} aria-hidden="true" />
              Settings
            </button>
            <PageHeader eyebrow="Settings / Company Management" title="Company Management" description="Configure the company profile, operating structure, and enterprise defaults." />
          </div>
          <div className="flex items-center gap-2 self-start rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2">
            <span className="size-2 rounded-full bg-[var(--status-success)]" />
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {roleLabel(data.role)}
            </span>
          </div>
        </div>

        {readOnly && (
          <div
            className="mb-5 flex gap-3 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4"
            role="status"
          >
            <ShieldAlert
              size={19}
              className="shrink-0 text-[var(--status-warning)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                View-only access
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Your role can view Company settings but cannot edit or publish them.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <CompanyNavigation
            active={activeSection}
            onChange={setActiveSection}
          />
          <div className="min-w-0">
            {activeSection === "overview" && (
              <CompanyOverview
                snapshot={draft}
                workflowStatus={data.workflowStatus}
                lastPublishedAt={data.lastPublishedAt}
              />
            )}
            {activeSection === "general" && (
              <CompanyGeneralInformation
                company={draft.company}
                errors={errors}
                readOnly={readOnly}
                canDisable={data.permissions.disable}
                uploading={uploading}
                fileInputRef={fileInputRef}
                onChange={(patch) =>
                  patchDraft({ company: { ...draft.company, ...patch } })
                }
                onLogoSelect={handleLogoSelect}
                onLogoRemove={() => void handleLogoRemove()}
              />
            )}
            {activeSection === "branches" && (
              <CompanyBranches
                branches={draft.branches}
                errors={errors}
                readOnly={readOnly}
                canDisable={data.permissions.disable}
                onChange={(branches) => patchDraft({ branches })}
              />
            )}
            {activeSection === "departments" && (
              <CompanyDepartments
                departments={draft.departments}
                branches={draft.branches}
                errors={errors}
                readOnly={readOnly}
                canDisable={data.permissions.disable}
                onChange={(departments) => patchDraft({ departments })}
              />
            )}
            {activeSection === "fiscal" && (
              <CompanyFiscalYear
                fiscalYear={draft.fiscalYear}
                errors={errors}
                readOnly={readOnly}
                onChange={(patch) =>
                  patchDraft({
                    fiscalYear: { ...draft.fiscalYear, ...patch },
                  })
                }
              />
            )}
            {activeSection === "currency" && (
              <CompanyCurrencySettings
                currency={draft.currency}
                readOnly={readOnly}
                onChange={(patch) =>
                  patchDraft({ currency: { ...draft.currency, ...patch } })
                }
              />
            )}
            {activeSection === "localization" && (
              <CompanyLocalizationSettings
                localization={draft.localization}
                readOnly={readOnly}
                onChange={(patch) =>
                  patchDraft({
                    localization: { ...draft.localization, ...patch },
                  })
                }
              />
            )}
            {activeSection === "calendar" && (
              <CompanyWorkingCalendar
                calendar={draft.workingCalendar}
                branches={draft.branches}
                readOnly={readOnly}
                onChange={(patch) =>
                  patchDraft({
                    workingCalendar: { ...draft.workingCalendar, ...patch },
                  })
                }
              />
            )}
          </div>
        </div>
      </main>

      {(data.permissions.edit || data.permissions.publish) && (
        <CompanyActionBar
          lastSavedAt={data.lastSavedAt}
          dirty={dirty}
          saving={saving}
          permissions={data.permissions}
          onReset={() => {
            setDraft(structuredClone(savedDraft));
            setErrors({});
          }}
          onSave={() => void handleSave()}
          onPublish={() => setPublishOpen(true)}
        />
      )}

      {publishOpen && (
        <PublishDialog
          changes={changeSummary}
          saving={saving}
          onClose={() => setPublishOpen(false)}
          onConfirm={() => void handlePublish()}
        />
      )}

      {toast && (
        <div
          className={cn(
            "fixed bottom-24 left-1/2 z-[90] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-[var(--radius-control-lg)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-overlay)]",
            toast.tone === "success"
              ? "bg-[var(--status-success)]"
              : "bg-[var(--status-danger)]",
          )}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          {toast.tone === "success" && (
            <CheckCircle2 size={17} aria-hidden="true" />
          )}
          {toast.message}
        </div>
      )}
    </CompanyShell>
  );
}

function CompanyShell({
  query,
  searchRef,
  onQueryChange,
  children,
}: {
  query: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1480px] px-4 pt-4 sm:px-5 sm:pt-5 xl:px-6 xl:pt-6">
        <div className="max-w-xl">
          <SettingsSearch
            value={query}
            onChange={onQueryChange}
            inputRef={searchRef}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function PublishDialog({
  changes,
  saving,
  onClose,
  onConfirm,
}: {
  changes: string[];
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[var(--text-primary)]/25 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-dialog-title"
    >
      <div className="w-full max-w-lg rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-overlay)]">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
          <div>
            <h2
              id="publish-dialog-title"
              className="text-lg font-semibold text-[var(--text-primary)]"
            >
              Publish Company Settings
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Published settings become active across the enterprise workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--surface-subtle)]"
            aria-label="Close publish confirmation"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">
            Summary of Changes
          </p>
          {changes.length ? (
            <ul className="mt-3 space-y-2">
              {changes.map((change) => (
                <li
                  key={change}
                  className="flex items-center gap-2 rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <span className="size-1.5 rounded-full bg-[var(--brand-500)]" />
                  {change}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No changes from the published configuration.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-4 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="min-h-11 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-sm font-semibold text-white disabled:opacity-45"
          >
            Confirm Publish
          </button>
        </div>
      </div>
    </div>
  );
}

function summarizeChanges(
  published: CompanySettingsSnapshot | undefined,
  draft: CompanySettingsSnapshot,
) {
  if (!published) return ["Initial Company configuration"];
  const sections: Array<[keyof CompanySettingsSnapshot, string]> = [
    ["company", "Company profile"],
    ["branches", "Branches"],
    ["departments", "Departments"],
    ["fiscalYear", "Fiscal year"],
    ["currency", "Currency"],
    ["localization", "Language & time zone"],
    ["workingCalendar", "Working calendar"],
  ];
  return sections
    .filter(
      ([key]) =>
        JSON.stringify(normalizeForComparison(published[key])) !==
        JSON.stringify(normalizeForComparison(draft[key])),
    )
    .map(([, label]) => label);
}

function normalizeForComparison(value: CompanySettingsSnapshot[keyof CompanySettingsSnapshot]) {
  if (!Array.isArray(value)) return value;
  return [...value].sort((left, right) => left.id.localeCompare(right.id));
}

function roleLabel(role: CompanyManagementResponse["role"]) {
  return {
    super_admin: "Super Admin",
    company_admin: "Company Admin",
    manager: "Manager",
    viewer: "Viewer",
  }[role];
}
