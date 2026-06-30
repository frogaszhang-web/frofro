export type Stage = "hirevue" | "first_round" | "superday";
export type RubricKind = "fit" | "behavioral" | "technical" | "pitch" | "brainteaser";

export interface Bank {
  name: string; tier: string; focus: string; funnel_stage: string;
  mandarin?: string; competition?: number; match?: number; style_notes: string; verified: boolean;
}

export interface Status {
  banks: number; verifiedBanks: number; topics: number; realQuestions: number;
  docsNeedingInput: string[];
  ai: { provider: string; grading_model: string; generation_model: string; key_present: boolean };
}

export interface Question { prompt: string; kind: RubricKind; topicTags: string[]; persona?: string; }
export interface Dimension { name: string; score: number; justification: string; }
export interface Grade {
  dimensions: Dimension[]; overall: number; followup: string;
  modelAnswer: string; flags: string[]; topicTags: string[];
}
export interface ResumeClaim { claim: string; hardestQuestion: string; whatWeakLooksLike: string; risk: "high" | "medium" | "low"; kind: RubricKind; }

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json() as Promise<T>;
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new Error((detail as any).detail || (detail as any).error || `${url} -> ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const getStatus = () => get<Status>("/api/status");
export const getBanks = () => get<Bank[]>("/api/banks");

export const startSession = (stage: Stage, bank?: string) =>
  post<{ sessionId: number; stage: Stage; bank: string | null; questions: Question[] }>("/api/session/start", { stage, bank });

export const gradeAnswer = (a: { sessionId?: number; question: string; kind: RubricKind; answer: string; bank?: string; topicTags?: string[] }) =>
  post<{ attemptId: number; grade: Grade }>("/api/grade", a);

export const probe = (a: { topic: string; question: string; followup: string; answer: string }) =>
  post<{ survived: boolean; verdict: string }>("/api/probe", a);

export const finishSession = (id: number) =>
  post<{ summary_score: number | null; attempts: number }>(`/api/session/${id}/finish`, {});

export const getResumeClaims = () => get<{ claims: ResumeClaim[] }>("/api/resume-claims");

export interface Progress {
  byStage: { stage: string; attempts: number; avg_overall: number | null }[];
  byBank: { bank: string; attempts: number; avg_overall: number | null }[];
  topics: { category: string; topic: string; mastery: string; verified: number }[];
  dueReviews: { id: number; question: string | null; rubric_kind: string | null; due_at: string }[];
}
export const getProgress = () => get<Progress>("/api/progress");
