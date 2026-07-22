"use client";

import { useCallback, useMemo, useState } from "react";
import { getLayerControls, type MapLayerState } from "./layers";

/**
 * Owns UI layer state separately from MapLibre. This keeps toggles stable while
 * the map is panned, zoomed, hovered, or switched between development sources.
 */
export function useMapLayerManager() {
  const controls = useMemo(() => getLayerControls(), []);
  const [layerState, setLayerState] = useState<MapLayerState>(() => Object.fromEntries(
    controls.map((control) => [control.id, control.enabled]),
  ));
  const setEnabled = useCallback((id: string, enabled: boolean) => {
    setLayerState((current) => ({ ...current, [id]: enabled }));
  }, []);
  const toggle = useCallback((id: string) => {
    setLayerState((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  return { controls, layerState, setEnabled, toggle };
}
