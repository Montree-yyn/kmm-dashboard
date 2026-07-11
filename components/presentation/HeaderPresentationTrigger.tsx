"use client";

import { PresentationTrigger } from "./PresentationTrigger";
import { usePresentationContext } from "./presentation-context";

export function HeaderPresentationTrigger() {
  const presentation = usePresentationContext();
  if (!presentation) return null;
  const toggle = () => {
    if (presentation.enabled) presentation.exit();
    else presentation.enter();
  };
  return (
    <PresentationTrigger
      active={presentation.enabled}
      onClick={toggle}
    />
  );
}
