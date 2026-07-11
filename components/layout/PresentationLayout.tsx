"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PresentationDock, type RotationInterval } from "../presentation/PresentationDock";
import { PresentationProvider } from "../presentation/presentation-context";
import { usePresentationMode } from "../../hooks/usePresentationMode";

const routes = ["/dashboard", "/sales", "/booking", "/stock", "/marketing", "/team"] as const;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function PresentationLayout({ children }: { children: React.ReactNode }) {
  const { enabled, enter, exit } = usePresentationMode();
  const [dockExpanded, setDockExpanded] = useState(false);
  const [rotateInterval, setRotateInterval] = useState<RotationInterval>(0);
  const pathname = usePathname();
  const router = useRouter();

  const currentIndex = useMemo(() => {
    const index = routes.findIndex((route) => pathname === route || pathname.startsWith(`${route}/`));
    return index >= 0 ? index : 0;
  }, [pathname]);

  const goTo = useCallback((index: number) => {
    router.push(routes[(index + routes.length) % routes.length]);
    setDockExpanded(true);
  }, [router]);

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const previous = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  useEffect(() => {
    document.documentElement.classList.toggle("presentation-mode", enabled);
    document.documentElement.classList.toggle("presentation-controls-open", enabled && dockExpanded);
    return () => {
      document.documentElement.classList.remove("presentation-mode");
      document.documentElement.classList.remove("presentation-controls-open");
    };
  }, [dockExpanded, enabled]);

  useEffect(() => {
    if (!enabled || rotateInterval === 0 || document.hidden || document.fullscreenElement?.getAttribute("role") === "dialog") return undefined;
    const id = window.setInterval(next, rotateInterval * 1000);
    return () => window.clearInterval(id);
  }, [enabled, next, rotateInterval]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!enabled || isTypingTarget(event.target)) return;
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
      if (event.key === "Home") { event.preventDefault(); goTo(0); }
      if (event.key.toLowerCase() === "r") { event.preventDefault(); window.location.reload(); }
      if (event.key === " ") { event.preventDefault(); setRotateInterval((value) => value > 0 ? 0 : 30); setDockExpanded(true); }
      if (event.key.toLowerCase() === "h") { event.preventDefault(); setDockExpanded((value) => !value); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, goTo, next, previous]);

  return (
    <PresentationProvider value={{ enabled, enter: () => { void enter(); }, exit: () => { void exit(); } }}>
      {children}
      {enabled && (
        <PresentationDock
          expanded={dockExpanded}
          rotateInterval={rotateInterval}
          onExpandedChange={setDockExpanded}
          onExit={() => { void exit(); }}
          onNext={next}
          onPrevious={previous}
          onRefresh={() => window.location.reload()}
          onRotateIntervalChange={setRotateInterval}
        />
      )}
    </PresentationProvider>
  );
}
