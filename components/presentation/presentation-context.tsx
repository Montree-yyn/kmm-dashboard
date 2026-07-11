"use client";

import { createContext, useContext } from "react";

type PresentationContextValue = {
  enabled: boolean;
  enter: () => void;
  exit: () => void;
};

const PresentationContext = createContext<PresentationContextValue | null>(null);

export function PresentationProvider({ value, children }: { value: PresentationContextValue; children: React.ReactNode }) {
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function usePresentationContext() {
  return useContext(PresentationContext);
}
