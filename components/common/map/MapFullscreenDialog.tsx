"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Minimize2, RotateCcw } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";

type MapFullscreenDialogProps = {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  onReset?: () => void;
};

export function MapFullscreenDialog({ open, title, subtitle, controls, children, onClose, onReset }: MapFullscreenDialogProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const shell = shellRef.current;
    let requestedFullscreen = false;
    if (shell?.requestFullscreen && !document.fullscreenElement) {
      void shell.requestFullscreen().then(() => { requestedFullscreen = true; }).catch(() => undefined);
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key.toLowerCase() === "r") onReset?.();
    };
    const handleFullscreenChange = () => {
      if (requestedFullscreen && !document.fullscreenElement) onClose();
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (requestedFullscreen && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose, onReset, open]);

  if (!open) return null;

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-white p-4 text-[#1F2937] sm:p-5 xl:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-[#EEF0F3] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-[#1F2937]">{title}</h2>
          {subtitle && <div className="mt-1 text-sm text-[#6B7280]">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          {onReset && (
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={onReset}>
              <RotateCcw size={15} />
              Reset View
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={onClose}>
            <Minimize2 size={15} />
            Exit Fullscreen
          </Button>
        </div>
      </div>
      <div className={cn("relative mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]")}>
        {children}
      </div>
    </div>
  );
}
