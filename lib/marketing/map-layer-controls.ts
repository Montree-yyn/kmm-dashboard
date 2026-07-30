import type { MapLayerState } from "../maps/layers";

export type MarketingLayerControl = {
  id: string;
  label: string;
  mapLayerGroup?: string;
  available: boolean;
  defaultEnabled: boolean;
  waitingReason?: string;
};

/**
 * The Marketing map only exposes controls for data-backed layers. Entries
 * without a source remain visible for planning, but cannot be enabled.
 */
export const MARKETING_LAYER_CONTROLS: readonly MarketingLayerControl[] = [
  { id: "township-boundary", label: "Township Boundary", mapLayerGroup: "township-boundary", available: true, defaultEnabled: true },
  { id: "showroom", label: "Showroom", mapLayerGroup: "showroom", available: true, defaultEnabled: true },
  { id: "dealer", label: "Dealer", available: false, defaultEnabled: false, waitingReason: "รอข้อมูล" },
  { id: "customer", label: "Customer", available: false, defaultEnabled: false, waitingReason: "รอข้อมูล" },
  { id: "sales-heatmap", label: "Sales Heatmap", mapLayerGroup: "heatmap", available: true, defaultEnabled: true },
  { id: "booking-heatmap", label: "Booking Heatmap", available: false, defaultEnabled: false, waitingReason: "รอข้อมูล" },
  { id: "sales-visit", label: "Sales Visit", available: false, defaultEnabled: false, waitingReason: "รอข้อมูล" },
  { id: "campaign", label: "Campaign", available: false, defaultEnabled: false, waitingReason: "รอข้อมูล" },
  { id: "competitor", label: "Competitor", available: false, defaultEnabled: false, waitingReason: "รอข้อมูล" },
  { id: "stock-location", label: "Stock Location", available: false, defaultEnabled: false, waitingReason: "รอข้อมูล" },
];

export function createMarketingLayerState(): MapLayerState {
  return Object.fromEntries(MARKETING_LAYER_CONTROLS.map((control) => [control.mapLayerGroup ?? control.id, control.defaultEnabled]));
}
