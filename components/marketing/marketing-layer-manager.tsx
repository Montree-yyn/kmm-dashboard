"use client";

import { Layers3, X } from "lucide-react";
import type { MapLayerState } from "../../lib/maps/layers";
import { MARKETING_LAYER_CONTROLS } from "../../lib/marketing/map-layer-controls";
import { cn } from "../../lib/utils";

type MarketingLayerManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layerState: MapLayerState;
  onToggle: (group: string) => void;
  showTrigger?: boolean;
};

export function MarketingLayerManager({
  open,
  onOpenChange,
  layerState,
  onToggle,
  showTrigger = true,
}: MarketingLayerManagerProps) {
  return (
    <div
      className={cn(
        "kmm-layer-manager pointer-events-auto absolute left-4 z-[7]",
        showTrigger ? "top-4" : "top-14",
      )}
      data-testid="marketing-layer-manager"
    >
      {showTrigger && (
        <button
          type="button"
          title="Map layers"
          aria-label="Open map layers"
          aria-expanded={open}
          aria-controls="marketing-layer-manager-panel"
          onClick={() => onOpenChange(!open)}
          className={cn(
            "kmm-map-tool-button grid size-11 place-items-center rounded-[var(--radius-control-lg)] text-[var(--text-secondary)] transition-colors",
            open ? "is-active text-[var(--brand-600)]" : "",
          )}
        >
          <Layers3 size={18} aria-hidden="true" />
        </button>
      )}
      {open && (
        <section
          id="marketing-layer-manager-panel"
          aria-label="Map layers"
          className="kmm-layer-manager-panel mt-2 w-[240px] rounded-[var(--radius-card)] bg-[var(--surface-elevated)] p-2.5"
        >
          <div className="mb-1 flex min-h-10 items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Map Layers
              </h2>
              <p className="text-[10px] text-[var(--text-tertiary)]">
                Marketing intelligence
              </p>
            </div>
            <button
              type="button"
              title="Close map layers"
              aria-label="Close map layers"
              onClick={() => onOpenChange(false)}
              className="grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <ul
            className="max-h-[min(420px,calc(100vh-180px))] space-y-0.5 overflow-y-auto"
            aria-label="Map layer visibility"
          >
            {MARKETING_LAYER_CONTROLS.map((control) => {
              const stateKey = control.mapLayerGroup ?? control.id;
              const checked = Boolean(layerState[stateKey]);
              return (
                <li
                  key={control.id}
                  className={cn(
                    "flex min-h-10 items-center justify-between gap-3 rounded-[var(--radius-control)] px-2 transition-colors hover:bg-[var(--surface-subtle)]",
                    !control.available && "opacity-60",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-[var(--text-primary)]">
                      {control.label}
                    </span>
                    {!control.available && (
                      <span className="block text-[10px] font-medium text-[var(--text-tertiary)]">
                        {control.waitingReason}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-label={`${control.label} visibility`}
                    aria-checked={checked}
                    disabled={!control.available}
                    onClick={() => onToggle(stateKey)}
                    className="kmm-layer-switch grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] disabled:cursor-not-allowed"
                  >
                    <span
                      className={cn(
                        "kmm-layer-switch-track relative h-[20px] w-[34px] rounded-full",
                        checked ? "is-checked" : "",
                      )}
                    >
                      <span
                        className={cn(
                          "kmm-layer-switch-thumb absolute inset-y-0 left-0 my-auto size-4 rounded-full bg-white",
                          checked ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
