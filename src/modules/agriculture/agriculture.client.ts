"use client";

import { auth } from "../../../lib/firebase";
import { resolveActiveCompanyId } from "../../../lib/company-context/client-store";
import { clientDataLayer } from "../../../lib/client-data-layer";
import type {
  AgricultureCalendarRow,
  AgricultureCropStatistic,
  AgricultureCropSummary,
  AgricultureCropWeatherStateRow,
  AgricultureContextRow,
  AgricultureDataGap,
  AgricultureHistoricalHazard,
  AgricultureHistoricalTrendRow,
  AgricultureLocationSummary,
  AgricultureOfficialYieldRow,
  AgricultureOpportunityRow,
  AgricultureOverviewPayload,
  AgricultureVarietyRow,
  AgricultureListResponse,
  AgricultureFieldVerificationInput,
  AgricultureFieldVerificationReviewInput,
} from "./agriculture.types";

export async function loadAgricultureOverview(companyId?: string) {
  return agricultureRequest<AgricultureOverviewPayload>("overview", companyId);
}

export async function loadAgricultureLocations(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureLocationSummary>>("locations", companyId);
}

export async function loadAgricultureCrops(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureCropSummary>>("crops", companyId);
}

export async function loadAgricultureCalendar(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureCalendarRow>>("calendar", companyId);
}

export async function loadAgricultureStatistics(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureCropStatistic>>("statistics", companyId);
}

export async function loadAgricultureHistoricalTrend(companyId?: string, params?: { geography?: string; crop?: string; from?: number; to?: number; metric?: string }) {
  const query = new URLSearchParams();
  if (params?.geography) query.set("geography", params.geography);
  if (params?.crop) query.set("crop", params.crop);
  if (params?.from) query.set("from", String(params.from));
  if (params?.to) query.set("to", String(params.to));
  if (params?.metric) query.set("metric", params.metric);
  return agricultureRequest<AgricultureListResponse<AgricultureHistoricalTrendRow>>("trends", companyId, query);
}

export async function loadAgricultureOfficialYield(companyId?: string, params?: { crop?: string; from?: number; to?: number }) {
  const query = new URLSearchParams();
  if (params?.crop) query.set("crop", params.crop);
  if (params?.from) query.set("from", String(params.from));
  if (params?.to) query.set("to", String(params.to));
  return agricultureRequest<AgricultureListResponse<AgricultureOfficialYieldRow>>("yield", companyId, query);
}

export async function loadAgricultureVarieties(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureVarietyRow>>("varieties", companyId);
}

export async function loadAgricultureHistoricalHazards(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureHistoricalHazard>>("hazards", companyId);
}

export async function loadAgricultureContexts(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureContextRow>>("contexts", companyId);
}

export async function loadAgricultureDataGaps(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureDataGap>>("gaps", companyId);
}

export async function loadAgricultureOpportunities(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureOpportunityRow>>("opportunities", companyId);
}

export async function loadAgricultureCropWeatherState(companyId?: string) {
  return agricultureRequest<AgricultureListResponse<AgricultureCropWeatherStateRow>>("state", companyId);
}

export async function createAgricultureFieldVerification(companyId: string | undefined, input: AgricultureFieldVerificationInput) {
  return agricultureMutate<{ ok: true; verificationId: string; verificationLevel: string; closedGapTypes: string[] }>("verifications", "POST", input, companyId);
}

export async function reviewAgricultureFieldVerification(companyId: string | undefined, input: AgricultureFieldVerificationReviewInput) {
  return agricultureMutate<{ ok: true; verificationId: string; status: string; verificationLevel: string }>("verifications", "PATCH", input, companyId);
}

async function agricultureRequest<T>(resource: string, companyId?: string, params?: URLSearchParams): Promise<T> {
  const resolvedCompanyId = resolveActiveCompanyId(companyId);
  // Stable cache key excludes the ts cache-buster (added per fetch below).
  const keyParams = new URLSearchParams(params);
  const cacheKey = `agriculture:${resource}:${resolvedCompanyId ?? "default"}:${keyParams.toString()}`;
  return clientDataLayer.request(cacheKey, () => fetchAgricultureResource<T>(resource, companyId, params));
}

async function fetchAgricultureResource<T>(resource: string, companyId?: string, params?: URLSearchParams): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again.");
  const resolvedCompanyId = resolveActiveCompanyId(companyId);
  const query = new URLSearchParams(params);
  query.set("ts", String(Date.now()));
  const response = await fetch(`/api/agriculture/${resource}?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(resolvedCompanyId ? { "X-Company-Id": resolvedCompanyId } : {}),
    },
    cache: "no-store",
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Unable to load Agriculture ${resource} (${response.status}).`);
  return payload;
}

async function agricultureMutate<T>(resource: string, method: "POST" | "PATCH", body: unknown, companyId?: string): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again.");
  const resolvedCompanyId = resolveActiveCompanyId(companyId);
  const response = await fetch(`/api/agriculture/${resource}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(resolvedCompanyId ? { "X-Company-Id": resolvedCompanyId } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Unable to save Agriculture verification (${response.status}).`);
  // A saved verification changes coverage/overview payloads — drop the cached
  // agriculture GETs so the next page load re-fetches fresh data.
  clientDataLayer.invalidatePrefix("agriculture:");
  return payload;
}
