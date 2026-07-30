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
};

export function MarketingLayerManager({ open, onOpenChange, layerState, onToggle }: MarketingLayerManagerProps) {
  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-[7]" data-testid="marketing-layer-manager">
      <button type="button" aria-label="Open map layers" aria-expanded={open} aria-controls="marketing-layer-manager-panel" onClick={() => onOpenChange(!open)} className="grid size-9 place-items-center rounded-lg border border-[#E5E7EB] bg-white text-[#4B5563] shadow-[0_3px_12px_rgba(31,41,55,0.12)] transition hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40">
        <Layers3 size={18} aria-hidden="true" />
      </button>
      {open && <section id="marketing-layer-manager-panel" aria-label="Map layers" className="mt-2 w-[228px] rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-[0_10px_28px_rgba(31,41,55,0.16)]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1F2937]">Layers</h2>
          <button type="button" aria-label="Close map layers" onClick={() => onOpenChange(false)} className="grid size-7 place-items-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40"><X size={15} aria-hidden="true" /></button>
        </div>
        <ul className="max-h-[min(460px,calc(100vh-180px))] space-y-1 overflow-y-auto" aria-label="Map layer visibility">
          {MARKETING_LAYER_CONTROLS.map((control) => {
            const stateKey = control.mapLayerGroup ?? control.id;
            const checked = Boolean(layerState[stateKey]);
            return <li key={control.id} className={cn("flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5", !control.available && "opacity-60")}>
              <span className="min-w-0"><span className="block truncate text-xs font-semibold text-[#374151]">{control.label}</span>{!control.available && <span className="block text-[10px] font-semibold text-[#9CA3AF]">{control.waitingReason}</span>}</span>
              <button type="button" role="switch" aria-label={`${control.label} visibility`} aria-checked={checked} disabled={!control.available} onClick={() => onToggle(stateKey)} className={cn("relative h-5 w-9 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 disabled:cursor-not-allowed", checked ? "bg-[#E86F00]" : "bg-[#D1D5DB]")}>
                <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition", checked ? "left-4.5" : "left-0.5")} />
              </button>
            </li>;
          })}
        </ul>
      </section>}
    </div>
  );
}
