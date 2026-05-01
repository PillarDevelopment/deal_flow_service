import {
  CAMPAIGN_STATUSES,
  ACTIVITY_TYPES,
  HYPOTHESIS_STATUSES,
  DEAL_PROPERTY_STATUSES,
  DEAL_STAGES,
  type CampaignStatus,
  type ActivityType,
  type HypothesisStatus,
  type DealPropertyStatus,
  type DealStage,
} from "./types.js";

export function normalizeString(value: unknown, maxLength = 1000) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
}

export function normalizeNullableString(value: unknown, maxLength = 1000) {
  const text = normalizeString(value, maxLength);
  return text || null;
}

export function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeBoolean(value: unknown) {
  return value === true || value === "true";
}

export function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => normalizeString(item, 120)).filter(Boolean)));
}

export function normalizeDealStage(value: unknown, fallback: DealStage = "new_lead") {
  return DEAL_STAGES.includes(value as DealStage) ? value as DealStage : fallback;
}

export function normalizeDealPropertyStatus(
  value: unknown,
  fallback: DealPropertyStatus = "shortlist",
) {
  return DEAL_PROPERTY_STATUSES.includes(value as DealPropertyStatus)
    ? value as DealPropertyStatus
    : fallback;
}

export function normalizeActivityType(value: unknown, fallback: ActivityType = "note") {
  return ACTIVITY_TYPES.includes(value as ActivityType) ? value as ActivityType : fallback;
}

export function normalizeCampaignStatus(value: unknown, fallback: CampaignStatus = "draft") {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus) ? value as CampaignStatus : fallback;
}

export function normalizeHypothesisStatus(value: unknown, fallback: HypothesisStatus = "draft") {
  return HYPOTHESIS_STATUSES.includes(value as HypothesisStatus)
    ? value as HypothesisStatus
    : fallback;
}
