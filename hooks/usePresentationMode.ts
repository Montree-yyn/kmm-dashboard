"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function usePresentationMode() {
  const [enabled, setEnabled] = useState(false);
  const fullscreenRequestedRef = useRef(false);

  const requestResize = useCallback(() => {
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 80);
  }, []);

  const enter = useCallback(async () => {
    setEnabled(true);
    requestResize();
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    await document.documentElement.requestFullscreen()
      .then(() => { fullscreenRequestedRef.current = true; })
      .catch(() => { fullscreenRequestedRef.current = false; });
  }, [requestResize]);

  const exit = useCallback(async () => {
    setEnabled(false);
    requestResize();
    fullscreenRequestedRef.current = false;
    if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => undefined);
  }, [requestResize]);

  const toggle = useCallback(async () => {
    if (enabled) await exit();
    else await enter();
  }, [enabled, enter, exit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape" && enabled) void exit();
      if (event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        void toggle();
      }
    };
    const onFullscreenChange = () => {
      if (enabled && fullscreenRequestedRef.current && !document.fullscreenElement) {
        fullscreenRequestedRef.current = false;
        setEnabled(false);
        requestResize();
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [enabled, exit, requestResize, toggle]);

  return { enabled, enter, exit, toggle };
}
