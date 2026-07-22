"use client";

import type maplibregl from "maplibre-gl";

let registered = false;

/** Registers PMTiles exactly once per browser runtime; safe to call from map setup. */
export async function registerPmtilesProtocol(maplibre: typeof maplibregl) {
  if (typeof window === "undefined" || registered) return;
  const { Protocol } = await import("pmtiles");
  const protocol = new Protocol();
  maplibre.addProtocol("pmtiles", protocol.tile);
  registered = true;
}

export function isPmtilesProtocolRegistered() {
  return registered;
}
