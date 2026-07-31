import type { RefObject } from "react";
import { Search, X } from "lucide-react";

type SettingsSearchProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
};

export function SettingsSearch({
  value,
  onChange,
  inputRef,
}: SettingsSearchProps) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        size={17}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] pl-10 pr-12 text-sm text-[var(--text-primary)] shadow-[var(--shadow-card)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        placeholder="Search settings..."
        aria-label="Search settings"
      />
      {value ? (
        <button
          type="button"
          className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Clear settings search"
        >
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
