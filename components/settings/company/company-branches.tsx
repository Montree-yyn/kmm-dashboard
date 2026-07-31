"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import type { Branch } from "../../../lib/company-management/types";
import type { ValidationErrors } from "../../../lib/company-management/validation";
import {
  CompanyInput,
  CompanySectionCard,
  CompanySelect,
  CompanyTextarea,
} from "./company-form-controls";

const PAGE_SIZE = 8;

export function CompanyBranches({
  branches,
  errors,
  readOnly,
  canDisable,
  onChange,
}: {
  branches: Branch[];
  errors: ValidationErrors;
  readOnly: boolean;
  canDisable: boolean;
  onChange: (branches: Branch[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"branchName" | "branchCode" | "region">(
    "branchName",
  );
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{
    mode: "add" | "edit" | "view";
    branch: Branch;
  } | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return branches
      .filter(
        (branch) =>
          status === "all" || branch.status === status,
      )
      .filter((branch) =>
        [
          branch.branchName,
          branch.branchCode,
          branch.region,
          branch.manager,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .sort((left, right) => left[sort].localeCompare(right[sort]));
  }, [branches, query, sort, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openNew() {
    setEditor({
      mode: "add",
      branch: {
        id: crypto.randomUUID(),
        branchName: "",
        branchCode: "",
        region: "",
        township: "",
        address: "",
        manager: "",
        phone: "",
        email: "",
        latitude: "",
        longitude: "",
        timeZone: "Asia/Yangon",
        users: 0,
        hasTransactions: false,
        status: "active",
      },
    });
  }

  function saveEditor() {
    if (!editor) return;
    const branch = {
      ...editor.branch,
      branchName: editor.branch.branchName.trim(),
      branchCode: editor.branch.branchCode.trim().toUpperCase(),
    };
    if (!branch.branchName || !branch.branchCode) return;
    onChange(
      editor.mode === "add"
        ? [...branches, branch]
        : branches.map((item) => (item.id === branch.id ? branch : item)),
    );
    setEditor(null);
  }

  function toggleStatus(branch: Branch) {
    if (branch.hasTransactions && branch.status === "active") {
      onChange(
        branches.map((item) =>
          item.id === branch.id ? { ...item, status: "disabled" } : item,
        ),
      );
      return;
    }
    onChange(
      branches.map((item) =>
        item.id === branch.id
          ? {
              ...item,
              status: item.status === "active" ? "disabled" : "active",
            }
          : item,
      ),
    );
  }

  return (
    <>
      <CompanySectionCard
        title="Branch Management"
        description="Branches remain in company history and are disabled instead of deleted."
        action={
          !readOnly && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              <Plus size={17} aria-hidden="true" />
              Add Branch
            </button>
          )
        }
      >
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
          <label className="relative block">
            <span className="sr-only">Search branches</span>
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-3.5 text-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search branches..."
              className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] pl-10 pr-3 text-sm outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter branches by status"
            className="h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value as "branchName" | "branchCode" | "region",
              )
            }
            aria-label="Sort branches"
            className="h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="branchName">Sort by name</option>
            <option value="branchCode">Sort by code</option>
            <option value="region">Sort by region</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-[var(--text-tertiary)]">
                {[
                  "Branch Name",
                  "Branch Code",
                  "Region",
                  "Manager",
                  "Phone",
                  "Email",
                  "Users",
                  "Status",
                  "Last Updated",
                  "Actions",
                ].map((header) => (
                  <th
                    key={header}
                    className="border-b border-[var(--border-default)] px-3 py-3"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((branch) => (
                <tr
                  key={branch.id}
                  className="transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {branch.branchName}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3 font-mono text-xs">
                    {branch.branchCode}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3">
                    {branch.region || "Not set"}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3">
                    {branch.manager || "Not set"}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3">
                    {branch.phone || "Not set"}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3">
                    {branch.email || "Not set"}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3 text-right tabular-nums">
                    {branch.users}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3">
                    <span
                      className={
                        branch.status === "active"
                          ? "rounded-full bg-[var(--status-success-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--status-success)]"
                          : "rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
                      }
                    >
                      {branch.status === "active" ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3 text-xs text-[var(--text-tertiary)]">
                    {branch.updatedAt
                      ? new Date(branch.updatedAt).toLocaleDateString()
                      : "Draft"}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-2">
                    <div className="flex items-center gap-1">
                      <IconButton
                        label={`View ${branch.branchName}`}
                        onClick={() => setEditor({ mode: "view", branch })}
                        icon={Eye}
                      />
                      {!readOnly && (
                        <IconButton
                          label={`Edit ${branch.branchName}`}
                          onClick={() => setEditor({ mode: "edit", branch })}
                          icon={Pencil}
                        />
                      )}
                      {!readOnly && canDisable && (
                          <IconButton
                            label={`${branch.status === "active" ? "Disable" : "Reactivate"} ${branch.branchName}`}
                            onClick={() => toggleStatus(branch)}
                            icon={
                              branch.status === "active" ? Power : RotateCcw
                            }
                          />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <div className="grid min-h-40 place-items-center border-b border-[var(--border-default)] text-sm text-[var(--text-secondary)]">
              No branches found.
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <span>
            {filtered.length} branch{filtered.length === 1 ? "" : "es"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 font-semibold disabled:opacity-45"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <span className="tabular-nums">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className="min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 font-semibold disabled:opacity-45"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </CompanySectionCard>

      {editor && (
        <BranchDialog
          mode={editor.mode}
          branch={editor.branch}
          errors={errors}
          onChange={(patch) =>
            setEditor((value) =>
              value
                ? { ...value, branch: { ...value.branch, ...patch } }
                : value,
            )
          }
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}
    </>
  );
}

function BranchDialog({
  mode,
  branch,
  errors,
  onChange,
  onClose,
  onSave,
}: {
  mode: "add" | "edit" | "view";
  branch: Branch;
  errors: ValidationErrors;
  onChange: (patch: Partial<Branch>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const readOnly = mode === "view";
  const prefix = `branch.${branch.id}.`;
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[var(--text-primary)]/25 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-dialog-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-overlay)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--surface-elevated)] px-5 py-4 backdrop-blur-lg">
          <h2
            id="branch-dialog-title"
            className="text-lg font-semibold text-[var(--text-primary)]"
          >
            {mode === "add"
              ? "Add Branch"
              : mode === "edit"
                ? "Edit Branch"
                : "Branch Details"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="Close branch editor"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <CompanyInput
            label="Branch Name"
            required
            value={branch.branchName}
            onChange={(event) => onChange({ branchName: event.target.value })}
            error={errors[`${prefix}branchName`]}
            disabled={readOnly}
          />
          <CompanyInput
            label="Branch Code"
            required
            value={branch.branchCode}
            onChange={(event) =>
              onChange({ branchCode: event.target.value.toUpperCase() })
            }
            error={errors[`${prefix}branchCode`]}
            disabled={readOnly}
          />
          <CompanyInput
            label="Region / State"
            value={branch.region}
            onChange={(event) => onChange({ region: event.target.value })}
            disabled={readOnly}
          />
          <CompanyInput
            label="Township / District"
            value={branch.township}
            onChange={(event) => onChange({ township: event.target.value })}
            disabled={readOnly}
          />
          <CompanyInput
            label="Manager"
            value={branch.manager}
            onChange={(event) => onChange({ manager: event.target.value })}
            disabled={readOnly}
          />
          <CompanyInput
            label="Phone"
            value={branch.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            disabled={readOnly}
          />
          <CompanyInput
            label="Email"
            type="email"
            value={branch.email}
            onChange={(event) => onChange({ email: event.target.value })}
            error={errors[`${prefix}email`]}
            disabled={readOnly}
          />
          <CompanySelect
            label="Time Zone"
            value={branch.timeZone}
            onChange={(event) => onChange({ timeZone: event.target.value })}
            disabled={readOnly}
          >
            <option value="Asia/Yangon">Asia/Yangon</option>
            <option value="Asia/Bangkok">Asia/Bangkok</option>
            <option value="UTC">UTC</option>
          </CompanySelect>
          <CompanyInput
            label="Latitude"
            inputMode="decimal"
            value={branch.latitude}
            onChange={(event) => onChange({ latitude: event.target.value })}
            disabled={readOnly}
          />
          <CompanyInput
            label="Longitude"
            inputMode="decimal"
            value={branch.longitude}
            onChange={(event) => onChange({ longitude: event.target.value })}
            disabled={readOnly}
          />
          <CompanySelect
            label="Status"
            value={branch.status}
            onChange={(event) =>
              onChange({
                status:
                  event.target.value === "disabled" ? "disabled" : "active",
              })
            }
            disabled={readOnly}
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </CompanySelect>
          <CompanyTextarea
            label="Address"
            value={branch.address}
            onChange={(event) => onChange({ address: event.target.value })}
            disabled={readOnly}
            className="sm:col-span-2"
          />
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--border-default)] bg-[var(--surface-elevated)] px-5 py-4 backdrop-blur-lg">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-4 text-sm font-semibold"
          >
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={onSave}
              disabled={!branch.branchName.trim() || !branch.branchCode.trim()}
              className="min-h-11 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-sm font-semibold text-white disabled:opacity-45"
            >
              Save Branch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Eye;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
