export const AGRICULTURE_OPPORTUNITY_MODEL_VERSION = "agri-opportunity-v0.1";

export const AGRICULTURE_OPPORTUNITY_WEIGHTS = {
  cropStageProximity: 25,
  customerContractorFit: 20,
  machineGap: 15,
  cropImportance: 15,
  weatherSuitabilityOrRisk: 15,
  salesBookingHistory: 10,
} as const;

export type AgricultureOpportunityInput = {
  cropStageProximity: number;
  customerContractorFit: number;
  machineGap: number;
  cropImportance: number;
  weatherSuitabilityOrRisk: number;
  salesBookingHistory: number;
  confidenceScore: number;
  stageKnown: boolean;
};

export type AgricultureOpportunityResult = {
  opportunityScore: number;
  confidenceScore: number;
  priorityScore: number;
  band: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MONITOR";
  reasonCodes: string[];
  recommendedAction: string | null;
  recommendationAllowed: boolean;
  modelVersion: string;
};

/**
 * Pure, deterministic v0.1 scoring. Inputs are normalized 0–100 signals;
 * this function never reads weather, ownership, dates, or customer data and
 * never invents them.
 */
export function calculateAgricultureOpportunity(
  input: AgricultureOpportunityInput,
): AgricultureOpportunityResult {
  const weightedScore = (
    clamp(input.cropStageProximity) * AGRICULTURE_OPPORTUNITY_WEIGHTS.cropStageProximity
    + clamp(input.customerContractorFit) * AGRICULTURE_OPPORTUNITY_WEIGHTS.customerContractorFit
    + clamp(input.machineGap) * AGRICULTURE_OPPORTUNITY_WEIGHTS.machineGap
    + clamp(input.cropImportance) * AGRICULTURE_OPPORTUNITY_WEIGHTS.cropImportance
    + clamp(input.weatherSuitabilityOrRisk) * AGRICULTURE_OPPORTUNITY_WEIGHTS.weatherSuitabilityOrRisk
    + clamp(input.salesBookingHistory) * AGRICULTURE_OPPORTUNITY_WEIGHTS.salesBookingHistory
  ) / 100;

  let opportunityScore = Math.round(weightedScore);
  const confidenceScore = clamp(input.confidenceScore);
  const reasonCodes: string[] = [];

  if (!input.stageKnown) {
    opportunityScore = Math.min(opportunityScore, 59);
    reasonCodes.push("NEEDS_VERIFICATION");
  }
  if (confidenceScore < 50) {
    opportunityScore = Math.min(opportunityScore, 79);
    reasonCodes.push("LOW_CONFIDENCE");
  }

  const recommendationAllowed = confidenceScore >= 35 && input.stageKnown;
  if (!recommendationAllowed && !reasonCodes.includes("NEEDS_VERIFICATION")) {
    reasonCodes.push("NEEDS_VERIFICATION");
  }

  const band = scoreBand(opportunityScore, confidenceScore);
  const priorityScore = recommendationAllowed ? opportunityScore : Math.min(opportunityScore, 39);

  return {
    opportunityScore,
    confidenceScore,
    priorityScore,
    band,
    reasonCodes,
    recommendedAction: recommendationAllowed ? "Review with the responsible field or sales owner." : null,
    recommendationAllowed,
    modelVersion: AGRICULTURE_OPPORTUNITY_MODEL_VERSION,
  };
}

function scoreBand(score: number, confidence: number): AgricultureOpportunityResult["band"] {
  if (confidence < 50 && score >= 80) return "HIGH";
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "MONITOR";
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
