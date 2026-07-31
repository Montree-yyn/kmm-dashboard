import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../../../lib/utils";

type FieldShellProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

function FieldShell({
  label,
  required,
  error,
  hint,
  children,
  className,
}: FieldShellProps) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
        {label}
        {required && <span className="ml-1 text-[var(--status-danger)]">*</span>}
      </span>
      {children}
      {(error || hint) && (
        <span
          className={cn(
            "mt-1.5 block text-xs leading-5",
            error
              ? "text-[var(--status-danger)]"
              : "text-[var(--text-tertiary)]",
          )}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  );
}

export function CompanyInput({
  label,
  required,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> &
  Omit<FieldShellProps, "children">) {
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <input
        {...props}
        className={cn(
          "h-11 w-full rounded-[var(--radius-control-lg)] border bg-[var(--surface-default)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150",
          "placeholder:text-[var(--text-disabled)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-tertiary)]",
          error
            ? "border-[var(--status-danger)]"
            : "border-[var(--border-default)]",
        )}
        aria-invalid={Boolean(error)}
      />
    </FieldShell>
  );
}

export function CompanySelect({
  label,
  required,
  error,
  hint,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> &
  Omit<FieldShellProps, "children"> & { children: ReactNode }) {
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <select
        {...props}
        className={cn(
          "h-11 w-full rounded-[var(--radius-control-lg)] border bg-[var(--surface-default)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150",
          "focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-tertiary)]",
          error
            ? "border-[var(--status-danger)]"
            : "border-[var(--border-default)]",
        )}
        aria-invalid={Boolean(error)}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function CompanyTextarea({
  label,
  required,
  error,
  hint,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> &
  Omit<FieldShellProps, "children">) {
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <textarea
        {...props}
        className={cn(
          "min-h-28 w-full resize-y rounded-[var(--radius-control-lg)] border bg-[var(--surface-default)] px-3 py-2.5 text-sm leading-6 text-[var(--text-primary)] outline-none transition-colors duration-150",
          "placeholder:text-[var(--text-disabled)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-tertiary)]",
          error
            ? "border-[var(--status-danger)]"
            : "border-[var(--border-default)]",
        )}
        aria-invalid={Boolean(error)}
      />
    </FieldShell>
  );
}

export function CompanySectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function CompanyToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        checked ? "bg-[var(--brand-500)]" : "bg-[var(--text-disabled)]",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <span
        className={cn(
          "block size-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
