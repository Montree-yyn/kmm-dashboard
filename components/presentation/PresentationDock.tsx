"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LogOut, Pause, Play, RefreshCw, Timer } from "lucide-react";

export type RotationInterval = 0 | 15 | 30 | 60;

type PresentationDockProps = {
  expanded: boolean;
  rotateInterval: RotationInterval;
  onExpandedChange: (expanded: boolean) => void;
  onExit: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRefresh: () => void;
  onRotateIntervalChange: (interval: RotationInterval) => void;
};

const intervals: Array<{ label: string; value: RotationInterval }> = [
  { label: "Off", value: 0 },
  { label: "15 seconds", value: 15 },
  { label: "30 seconds", value: 30 },
  { label: "60 seconds", value: 60 },
];

export function PresentationDock({
  expanded,
  rotateInterval,
  onExpandedChange,
  onExit,
  onNext,
  onPrevious,
  onRefresh,
  onRotateIntervalChange,
}: PresentationDockProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);

  const reveal = useCallback(() => {
    onExpandedChange(true);
  }, [onExpandedChange]);

  useEffect(() => {
    if (!expanded || menuOpen || hoverRef.current || focusRef.current) return undefined;
    const id = window.setTimeout(() => onExpandedChange(false), 3000);
    return () => window.clearTimeout(id);
  }, [expanded, menuOpen, onExpandedChange]);

  useEffect(() => {
    const onPointerMove = () => reveal();
    const onPointerDown = () => reveal();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [reveal]);

  if (!expanded) return null;

  return (
    <div
      className="presentation-dock"
      onMouseEnter={() => { hoverRef.current = true; reveal(); }}
      onMouseLeave={() => { hoverRef.current = false; }}
      onFocus={() => { focusRef.current = true; reveal(); }}
      onBlur={() => { focusRef.current = false; }}
    >
      <div className="presentation-dock-panel" aria-label="Presentation controls">
          <button type="button" title="Previous page" aria-label="Previous page" onClick={onPrevious}><ChevronLeft size={17} /></button>
          <button type="button" title="Next page" aria-label="Next page" onClick={onNext}><ChevronRight size={17} /></button>
          <button type="button" title={rotateInterval > 0 ? "Pause auto rotate" : "Resume auto rotate"} aria-label={rotateInterval > 0 ? "Pause auto rotate" : "Resume auto rotate"} onClick={() => onRotateIntervalChange(rotateInterval > 0 ? 0 : 30)}>{rotateInterval > 0 ? <Pause size={16} /> : <Play size={16} />}</button>
          <button type="button" title="Refresh data" aria-label="Refresh data" onClick={onRefresh}><RefreshCw size={16} /></button>
          <div className="presentation-rotate">
            <button type="button" title="Auto rotate" aria-label="Auto rotate" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
              <Timer size={16} />
              {rotateInterval > 0 && <span className="presentation-active-dot" />}
            </button>
            {menuOpen && (
              <div className="presentation-rotate-menu" role="menu">
                {intervals.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={rotateInterval === item.value}
                    onClick={() => { onRotateIntervalChange(item.value); setMenuOpen(false); }}
                  >
                    <span>{item.label}</span>
                    {rotateInterval === item.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" title="Exit presentation" aria-label="Exit presentation" onClick={onExit}><LogOut size={16} /></button>
        </div>
    </div>
  );
}
