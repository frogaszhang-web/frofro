// Shared entity types (mirrors §9 of the brief).

export type Tier = "BB" | "EB" | "MM" | "boutique";
export type FunnelStage =
  | "not_started"
  | "networking"
  | "applied"
  | "hirevue"
  | "first_round"
  | "superday"
  | "offer"
  | "rejected";
export type Stage = "hirevue" | "first_round" | "superday";
export type Mastery = "strong" | "shaky" | "review";

export interface WarmContact {
  name: string;
  role: string;
  notes: string;
}

export interface Bank {
  name: string;
  tier: Tier;
  hk_office: boolean;
  focus: string;
  recent_deals: string[];
  warm_contacts: WarmContact[];
  funnel_stage: FunnelStage;
  mandarin?: "none" | "asset" | "required";
  competition?: number;
  match?: number;
  assessment?: string;
  process?: string;
  style_notes: string;
  verified: boolean;
}

export interface TechnicalTopic {
  id?: number;
  category: string;
  topic: string;
  subtopics: string;
  mastery: Mastery;
  verified: boolean;
}

export interface RealQuestion {
  id?: number;
  bank: string;
  stage: Stage;
  question: string;
  source: string;
  date: string;
}

// Stories / sessions / attempts / progress get full shapes in Phase 3.
