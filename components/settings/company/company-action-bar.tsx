import { LoaderCircle, RotateCcw, Save, Send } from "lucide-react";
import type { CompanyPermissions } from "../../../lib/company-management/types";

export function CompanyActionBar({
  lastSavedAt,
  dirty,
  saving,
  permissions,
  onReset,
  onSave,
  onPublish,
}: {
  lastSavedAt: string | null;
  dirty: boolean;
  saving: boolean;
  permissions: CompanyPermissions;
  onReset: () => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-30 mt-6 border-t border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-elevated)_94%,transparent)] px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.05)] backdrop-blur-lg sm:px-5">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-[var(--brand-50)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-600)]">
              Draft
            </span>
            {dirty && (
              <span className="text-xs font-medium text-[var(--status-warning)]">
                Unsaved changes
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            {lastSavedAt
              ? `Last saved ${new Date(lastSavedAt).toLocaleString()}`
              : "Not saved yet"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex">
          <button
            type="button"
            onClick={onReset}
            disabled={!dirty || saving || !permissions.edit}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </button>
          {permissions.edit && (
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control-lg)] border border-[var(--brand-500)] bg-[var(--brand-50)] px-3 text-sm font-semibold text-[var(--brand-600)] hover:bg-[var(--brand-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
              ) : (
                <Save size={16} aria-hidden="true" />
              )}
              Save Draft
            </button>
          )}
          {permissions.publish && (
            <button
              type="button"
              onClick={onPublish}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-card)] hover:bg-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send size={16} aria-hidden="true" />
              Publish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
