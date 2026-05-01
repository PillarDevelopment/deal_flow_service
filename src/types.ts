export type AppRole = "super_admin" | "operator" | "analyst" | "subscriber";

export type AuthContext = {
  userId: string;
  email: string | null;
  role: AppRole;
};

export type DealStage =
  | "new_lead"
  | "contacted"
  | "qualified"
  | "objects_sent"
  | "discussion"
  | "meeting"
  | "negotiation"
  | "won"
  | "lost";

export type DealPropertyStatus =
  | "shortlist"
  | "sent"
  | "viewed"
  | "feedback_pending"
  | "rejected"
  | "in_negotiation";

export type ActivityType =
  | "call"
  | "message"
  | "meeting"
  | "object_sent"
  | "feedback"
  | "status_changed"
  | "note";

export type CampaignStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "archived";

export type HypothesisStatus = "draft" | "approved" | "rejected" | "deprecated";

export const DEAL_STAGES: DealStage[] = [
  "new_lead",
  "contacted",
  "qualified",
  "objects_sent",
  "discussion",
  "meeting",
  "negotiation",
  "won",
  "lost",
];

export const DEAL_PROPERTY_STATUSES: DealPropertyStatus[] = [
  "shortlist",
  "sent",
  "viewed",
  "feedback_pending",
  "rejected",
  "in_negotiation",
];

export const ACTIVITY_TYPES: ActivityType[] = [
  "call",
  "message",
  "meeting",
  "object_sent",
  "feedback",
  "status_changed",
  "note",
];

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "draft",
  "needs_review",
  "approved",
  "scheduled",
  "running",
  "paused",
  "completed",
  "archived",
];

export const HYPOTHESIS_STATUSES: HypothesisStatus[] = [
  "draft",
  "approved",
  "rejected",
  "deprecated",
];
