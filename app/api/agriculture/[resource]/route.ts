import { AuthError } from "../../../../lib/server/firebase-auth";
import { CompanyAccessError, requireCompanyContext } from "../../../../lib/server/company-context";
import {
  getAgricultureOverview,
  getAgricultureConfidenceDetail,
  listAgricultureCalendar,
  listAgricultureCrops,
  listAgricultureCropWeatherState,
  listAgricultureContexts,
  listAgricultureDataGaps,
  listAgricultureHistoricalHazards,
  listAgricultureHistoricalTrend,
  listAgricultureLocations,
  listAgricultureOfficialYield,
  listAgricultureOpportunities,
  listAgricultureSources,
  listAgricultureStatistics,
  listAgricultureVarieties,
  listAgricultureVerifications,
  AgricultureInputError,
  createAgricultureFieldVerification,
  reviewAgricultureFieldVerification,
} from "../../../../src/modules/agriculture/agriculture.service";
import { fetchLiveWeather } from "../../../../src/modules/weather/data/weather.live";
import { getOperationsDb } from "../../../../db";
import { agriFieldVerifications } from "../../../../db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ resource: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { resource } = await context.params;
    const company = await requireCompanyContext(request, { permission: "view" });
    const db = await getOperationsDb();
    const url = new URL(request.url);

    if (resource === "overview") {
      let weather = null;
      let weatherError: string | null = null;
      try {
        weather = await fetchLiveWeather({ forceRefresh: url.searchParams.get("refresh") === "1" });
      } catch (error) {
        weatherError = error instanceof Error ? error.message : "Live weather is unavailable.";
      }
      return json(await getAgricultureOverview(db, company.id, weather, weatherError));
    }

    if (resource === "locations") {
      return json(await listResponse(company.id, await listAgricultureLocations(db)));
    }
    if (resource === "crops") {
      return json(await listResponse(company.id, await listAgricultureCrops(db)));
    }
    if (resource === "calendar") {
      return json(await listResponse(company.id, await listAgricultureCalendar(db, url.searchParams.get("location") ?? undefined, url.searchParams.get("crop") ?? undefined, url.searchParams.get("season") ?? undefined, integerParam(url.searchParams.get("year")))));
    }
    if (resource === "statistics") {
      return json(await listResponse(company.id, await listAgricultureStatistics(db, url.searchParams.get("location") ?? undefined, url.searchParams.get("crop") ?? undefined)));
    }
    if (resource === "yield") {
      return json(await listResponse(company.id, await listAgricultureOfficialYield(db, url.searchParams.get("crop") ?? undefined, integerParam(url.searchParams.get("from")), integerParam(url.searchParams.get("to")))));
    }
    if (resource === "trends") {
      return json(await listResponse(company.id, await listAgricultureHistoricalTrend(db, {
        geography: url.searchParams.get("geography") ?? undefined,
        cropId: url.searchParams.get("crop") ?? undefined,
        fromYear: integerParam(url.searchParams.get("from")),
        toYear: integerParam(url.searchParams.get("to")),
        metric: trendMetricParam(url.searchParams.get("metric")),
      })));
    }
    if (resource === "varieties") {
      return json(await listResponse(company.id, await listAgricultureVarieties(db, url.searchParams.get("location") ?? undefined, url.searchParams.get("crop") ?? undefined)));
    }
    if (resource === "hazards") {
      return json(await listResponse(company.id, await listAgricultureHistoricalHazards(db, url.searchParams.get("location") ?? undefined)));
    }
    if (resource === "contexts") {
      return json(await listResponse(company.id, await listAgricultureContexts(db, url.searchParams.get("location") ?? undefined)));
    }
    if (resource === "gaps") {
      return json(await listResponse(company.id, await listAgricultureDataGaps(db, url.searchParams.get("location") ?? undefined)));
    }
    if (resource === "state") {
      return json(await listResponse(company.id, await listAgricultureCropWeatherState(db)));
    }
    if (resource === "opportunities") {
      return json(await listResponse(company.id, await listAgricultureOpportunities(db, company.id, {
        locationId: url.searchParams.get("location") ?? undefined,
        cropId: url.searchParams.get("crop") ?? undefined,
        seasonId: url.searchParams.get("season") ?? undefined,
        salespersonId: url.searchParams.get("salesperson") ?? undefined,
        machineCategory: url.searchParams.get("machine") ?? undefined,
        priority: url.searchParams.get("priority") ?? undefined,
        confidence: url.searchParams.get("confidence") ?? undefined,
      })));
    }
    if (resource === "verifications") {
      return json(await listResponse(company.id, await listAgricultureVerifications(db, company.id, url.searchParams.get("location") ?? undefined)));
    }
    if (resource === "sources") {
      return json(await listResponse(company.id, await listAgricultureSources(db)));
    }
    if (resource === "confidence") {
      return json({ companyId: company.id, dataStatus: "needs_verification" as const, ...(await getAgricultureConfidenceDetail(db)) });
    }
    return Response.json({ error: "Agriculture resource not found." }, { status: 404 });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { resource } = await context.params;
    if (resource !== "verifications") return Response.json({ error: "This Agriculture resource is read-only." }, { status: 405 });
    const company = await requireCompanyContext(request, { permission: "edit" });
    const payload = await request.json() as Record<string, unknown>;
    const locationId = stringValue(payload.locationId);
    const cropId = optionalString(payload.cropId);
    const isStructured = Boolean(cropId && (payload.cropYear !== undefined || payload.cropPresence !== undefined || payload.verificationMethod !== undefined));
    if (isStructured) {
      const input = parseFieldVerificationPayload(payload, company.user.id, company.role);
      const db = await getOperationsDb();
      const result = await createAgricultureFieldVerification(db, company.id, input);
      return json({ ok: true, ...result }, 201);
    }

    const fieldName = stringValue(payload.fieldName);
    const proposedValue = stringValue(payload.proposedValue);
    const evidence = stringValue(payload.evidence);
    const verificationLevel = optionalString(payload.verificationLevel) ?? "V2";
    if (!locationId || !fieldName || !proposedValue || !evidence) {
      return Response.json({ error: "locationId, fieldName, proposedValue, and evidence are required." }, { status: 422 });
    }
    if (!/^V[2-4]$/.test(verificationLevel)) {
      return Response.json({ error: "verificationLevel must be V2, V3, or V4." }, { status: 422 });
    }
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(locationId) || fieldName.length > 80 || proposedValue.length > 2000 || evidence.length > 4000) {
      return Response.json({ error: "Verification fields are invalid or too long." }, { status: 422 });
    }

    const db = await getOperationsDb();
    const verificationId = crypto.randomUUID();
    await db.insert(agriFieldVerifications).values({
      verificationId,
      companyId: company.id,
      locationId,
      cropId: cropId ?? null,
      fieldName,
      proposedValue,
      verificationLevel,
      evidence,
      verifiedRole: company.role,
      sourceId: optionalString(payload.sourceId) ?? null,
      verifiedBy: company.user.id,
      verifiedAt: new Date().toISOString(),
      status: "PENDING",
      createdBy: company.user.id,
      updatedBy: company.user.id,
    });
    return json({ ok: true, verificationId }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { resource } = await context.params;
    if (resource !== "verifications") return Response.json({ error: "This Agriculture resource is read-only." }, { status: 405 });
    const company = await requireCompanyContext(request, { permission: "edit" });
    const payload = await request.json() as Record<string, unknown>;
    const verificationId = stringValue(payload.verificationId);
    const status = stringValue(payload.status);
    if (!verificationId || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(verificationId)) return Response.json({ error: "verificationId is required." }, { status: 422 });
    if (status !== "APPROVED" && status !== "REJECTED") return Response.json({ error: "status must be APPROVED or REJECTED." }, { status: 422 });
    const verificationLevel = optionalString(payload.verificationLevel);
    if (verificationLevel && !/^V[2-4]$/.test(verificationLevel)) return Response.json({ error: "verificationLevel must be V2, V3, or V4." }, { status: 422 });
    const db = await getOperationsDb();
    const result = await reviewAgricultureFieldVerification(db, company.id, {
      verificationId,
      status,
      verificationLevel: verificationLevel as "V2" | "V3" | "V4" | undefined,
      reviewedBy: company.user.id,
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return handleError(error);
  }
}

function listResponse<T>(companyId: string, rows: T[]) {
  return {
    source: "local-d1" as const,
    companyId,
    dataStatus: rows.length ? "available" as const : "needs_verification" as const,
    rows,
  };
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function handleError(error: unknown) {
  const status = error instanceof AuthError || error instanceof CompanyAccessError || error instanceof AgricultureInputError ? error.status : 500;
  return Response.json({ error: error instanceof Error ? error.message : "Unable to load Agriculture data." }, { status, headers: { "Cache-Control": "no-store" } });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  const normalized = stringValue(value);
  return normalized || null;
}

function parseFieldVerificationPayload(payload: Record<string, unknown>, verifiedBy: string, verifiedRole: string) {
  const locationId = stringValue(payload.locationId);
  const cropId = stringValue(payload.cropId);
  const cropYear = numberValue(payload.cropYear);
  const evidence = optionalString(payload.evidence) ?? optionalString(payload.notes) ?? "Local field verification submission";
  if (!locationId || !cropId || cropYear === null) throw new AgricultureInputError("locationId, cropId, and cropYear are required.");
  if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(locationId) || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(cropId)) throw new AgricultureInputError("locationId or cropId is invalid.");
  return {
    locationId,
    cropId,
    cropYear,
    seasonCode: optionalString(payload.seasonCode),
    cropPresence: enumValue(payload.cropPresence, ["YES", "NO", "UNKNOWN"] as const, "cropPresence"),
    importance: enumValue(payload.importance, ["MAJOR", "SECONDARY", "MINOR", "UNKNOWN"] as const, "importance"),
    estimatedArea: numberOrNull(payload.estimatedArea),
    areaUnit: optionalString(payload.areaUnit),
    areaQuality: enumValue(payload.areaQuality, ["KNOWN", "APPROXIMATE", "UNKNOWN"] as const, "areaQuality"),
    plantingStartMonth: numberOrNull(payload.plantingStartMonth),
    plantingEndMonth: numberOrNull(payload.plantingEndMonth),
    harvestStartMonth: numberOrNull(payload.harvestStartMonth),
    harvestEndMonth: numberOrNull(payload.harvestEndMonth),
    currentStage: optionalString(payload.currentStage),
    irrigationType: enumValue(payload.irrigationType, ["RAIN_FED", "IRRIGATED", "MIXED", "UNKNOWN"] as const, "irrigationType"),
    mechanizationLevel: enumValue(payload.mechanizationLevel, ["LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const, "mechanizationLevel"),
    commonMachines: arrayValue(payload.commonMachines),
    notes: optionalString(payload.notes),
    verificationMethod: enumValue(payload.verificationMethod ?? "OTHER", ["FIELD_VISIT", "BRANCH_REPORT", "SALESPERSON_REPORT", "CUSTOMER_REPORT", "MANAGER_CONFIRMATION", "OTHER"] as const, "verificationMethod"),
    verificationLevel: enumValue(payload.verificationLevel ?? "V2", ["V2", "V3", "V4"] as const, "verificationLevel"),
    confidenceScore: numberOrNull(payload.confidenceScore),
    evidence,
    sourceId: optionalString(payload.sourceId),
    verifiedBy,
    verifiedRole,
  };
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const normalized = stringValue(value) || "UNKNOWN";
  if (!allowed.includes(normalized as T)) throw new AgricultureInputError(`${field} is invalid.`);
  return normalized as T;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function numberOrNull(value: unknown) {
  return value === null || value === undefined || value === "" ? null : numberValue(value);
}

function arrayValue(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function integerParam(value: string | null) {
  if (!value || !/^\d{4}$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function trendMetricParam(value: string | null) {
  return ["SOWN_AREA", "HARVESTED_AREA", "PRODUCTION"].includes(value ?? "")
    ? value as "SOWN_AREA" | "HARVESTED_AREA" | "PRODUCTION"
    : undefined;
}
