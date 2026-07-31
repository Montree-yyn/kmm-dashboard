"use client";

import { useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import type {
  Branch,
  Department,
} from "../../../lib/company-management/types";
import type { ValidationErrors } from "../../../lib/company-management/validation";
import {
  CompanyInput,
  CompanySectionCard,
  CompanySelect,
} from "./company-form-controls";

export function CompanyDepartments({
  departments,
  branches,
  errors,
  readOnly,
  canDisable,
  onChange,
}: {
  departments: Department[];
  branches: Branch[];
  errors: ValidationErrors;
  readOnly: boolean;
  canDisable: boolean;
  onChange: (departments: Department[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [editor, setEditor] = useState<Department | null>(null);
  const [isNew, setIsNew] = useState(false);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return departments.filter(
      (department) =>
        (branchFilter === "all" || department.branchId === branchFilter) &&
        [department.departmentName, department.departmentCode, department.head]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
    );
  }, [branchFilter, departments, query]);
  const branchName = new Map(
    branches.map((branch) => [branch.id, branch.branchName]),
  );

  function openNew() {
    setIsNew(true);
    setEditor({
      id: crypto.randomUUID(),
      departmentName: "",
      departmentCode: "",
      branchId: "",
      head: "",
      users: 0,
      status: "active",
    });
  }

  function saveEditor() {
    if (!editor?.departmentName.trim() || !editor.departmentCode.trim()) return;
    const normalized = {
      ...editor,
      departmentName: editor.departmentName.trim(),
      departmentCode: editor.departmentCode.trim().toUpperCase(),
    };
    onChange(
      isNew
        ? [...departments, normalized]
        : departments.map((item) =>
            item.id === normalized.id ? normalized : item,
          ),
    );
    setEditor(null);
  }

  return (
    <>
      <CompanySectionCard
        title="Department Management"
        description="Departments are editable company structures and are never locked to initial examples."
        action={
          !readOnly && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              <Plus size={17} aria-hidden="true" />
              Add Department
            </button>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_220px]">
          <label className="relative block">
            <span className="sr-only">Search departments</span>
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-3.5 text-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search departments..."
              className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] pl-10 pr-3 text-sm outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </label>
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            aria-label="Filter departments by branch"
            className="h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branchName}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-[var(--text-tertiary)]">
                {[
                  "Department Name",
                  "Department Code",
                  "Branch",
                  "Head",
                  "Users",
                  "Status",
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
              {visible.map((department) => (
                <tr
                  key={department.id}
                  className="hover:bg-[var(--surface-subtle)]"
                >
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3 font-semibold">
                    {department.departmentName}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3 font-mono text-xs">
                    {department.departmentCode}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3">
                    {branchName.get(department.branchId) || "All company"}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3">
                    {department.head || "Not set"}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3 text-right tabular-nums">
                    {department.users}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-3">
                    <span
                      className={
                        department.status === "active"
                          ? "rounded-full bg-[var(--status-success-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--status-success)]"
                          : "rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
                      }
                    >
                      {department.status === "active" ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-3 py-2">
                    <div className="flex gap-1">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNew(false);
                            setEditor(department);
                          }}
                          aria-label={`Edit ${department.departmentName}`}
                          className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      )}
                      {!readOnly && canDisable && (
                          <button
                            type="button"
                            onClick={() =>
                              onChange(
                                departments.map((item) =>
                                  item.id === department.id
                                    ? {
                                        ...item,
                                        status:
                                          item.status === "active"
                                            ? "disabled"
                                            : "active",
                                      }
                                    : item,
                                ),
                              )
                            }
                            aria-label={`${department.status === "active" ? "Disable" : "Reactivate"} ${department.departmentName}`}
                            className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            {department.status === "active" ? (
                              <Power size={16} aria-hidden="true" />
                            ) : (
                              <RotateCcw size={16} aria-hidden="true" />
                            )}
                          </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <div className="grid min-h-40 place-items-center text-sm text-[var(--text-secondary)]">
              No departments found.
            </div>
          )}
        </div>
      </CompanySectionCard>

      {editor && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[var(--text-primary)]/25 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="department-dialog-title"
        >
          <div className="w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-overlay)]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
              <h2
                id="department-dialog-title"
                className="text-lg font-semibold text-[var(--text-primary)]"
              >
                {isNew ? "Add Department" : "Edit Department"}
              </h2>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--surface-subtle)]"
                onClick={() => setEditor(null)}
                aria-label="Close department editor"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <CompanyInput
                label="Department Name"
                required
                value={editor.departmentName}
                onChange={(event) =>
                  setEditor({ ...editor, departmentName: event.target.value })
                }
                error={errors[`department.${editor.id}.departmentName`]}
              />
              <CompanyInput
                label="Department Code"
                required
                value={editor.departmentCode}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    departmentCode: event.target.value.toUpperCase(),
                  })
                }
                error={errors[`department.${editor.id}.departmentCode`]}
              />
              <CompanySelect
                label="Branch"
                value={editor.branchId}
                onChange={(event) =>
                  setEditor({ ...editor, branchId: event.target.value })
                }
              >
                <option value="">All company</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branchName}
                  </option>
                ))}
              </CompanySelect>
              <CompanyInput
                label="Head"
                value={editor.head}
                onChange={(event) =>
                  setEditor({ ...editor, head: event.target.value })
                }
              />
              <CompanySelect
                label="Status"
                value={editor.status}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    status:
                      event.target.value === "disabled"
                        ? "disabled"
                        : "active",
                  })
                }
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </CompanySelect>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-4 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditor}
                disabled={
                  !editor.departmentName.trim() ||
                  !editor.departmentCode.trim()
                }
                className="min-h-11 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-sm font-semibold text-white disabled:opacity-45"
              >
                Save Department
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
