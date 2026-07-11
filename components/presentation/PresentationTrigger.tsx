"use client";

import { MonitorPlay } from "lucide-react";

type PresentationTriggerProps = {
  active: boolean;
  onClick: () => void;
};

export function PresentationTrigger({ active, onClick }: PresentationTriggerProps) {
  return (
    <button
      type="button"
      className="presentation-trigger"
      aria-label={active ? "Exit presentation mode" : "Enter presentation mode"}
      aria-pressed={active}
      title="Presentation Mode"
      onClick={onClick}
    >
      <MonitorPlay size={18} aria-hidden="true" />
    </button>
  );
}
