import db from "./db.js";
import { chat, type Tier } from "./ai.js";

// ---------------------------------------------------------------------------
// Question generation + grading engine (§5, §6, §7).
// All model output is grounded ONLY in the candidate's own files + the verified
// per-bank notes. Never invents firm-specific facts (§7).
// ---------------------------------------------------------------------------

export type Stage = "hirevue" | "first_round" | "superday";
export type RubricKind = "fit" | "behavioral" | "technical" | "pitch" | "brainteaser";

export interface GenQuestion {
  prompt: string;
  kind: RubricKind;
  topicTags: string[];
  persona?: string; // Stage C only: "Friendly analyst" | "Skeptical VP" | "Stress-testing MD"
}

export interface Dimension { name: string; score: number; justification: string; }
export interface Grade {
  dimensions: Dimension[];
  overall: number;
  followup: string;
  modelAnswer: string;
  flags: string[];
  topicTags: string[];
}

const DIMENSIONS: Record<RubricKind, string[]> = {
  technical: ["correctness", "completeness", "precision", "defensibility", "structure"],
  behavioral: ["star_completeness", "specificity", "relevance", "conciseness", "self_awareness"],
  fit: ["conviction", "specificity", "coherence", "red_flag_check"],
  pitch: ["thesis_clarity", "depth", "risk_awareness", "valuation_grounding"],
  brainteaser: ["approach", "correctness", "composure"],
};

// ---- grounding context -----------------------------------------------------

function doc(key: string): string {
  const r = db.prepare("SELECT content FROM docs WHERE key = ?").get(key) as { content: string } | undefined;
  return r?.content ?? "";
}

export function getBank(name: string): any | null {
  const r = db.prepare("SELECT json FROM banks WHERE name = ?").get(name) as { json: string } | undefined;
  return r ? JSON.parse(r.json) : null;
}

function realQuestionsFor(bank: string, stage: Stage): string[] {
  const rows = db.prepare("SELECT question FROM real_questions WHERE bank = ? AND stage = ?").all(bank, stage) as { question: string }[];
  return rows.map((r) => r.question);
}

function weakTopics(): string[] {
  const rows = db.prepare("SELECT topic FROM technical_topics WHERE mastery IN ('review','shaky') ORDER BY mastery DESC LIMIT 8").all() as { topic: string }[];
  return rows.map((r) => r.topic);
}

const INTEGRITY = `INTEGRITY RULES (non-negotiable):
- Never invent firm-specific facts (deals, interviewer names, exact processes). Tailor ONLY from the bank's tier/type/region and the notes provided. If you don't have a grounded fact, speak in general patterns, not claims about this specific bank.
- If you are uncertain about a technical point, say so rather than assert.
- Every output must be defensible one sentence further.`;

function bankContext(bank: any | null): string {
  if (!bank) return "No specific bank — use general HK cross-border IB context.";
  return [
    `Bank: ${bank.name} (tier ${bank.tier}; ${bank.verified ? "VERIFIED notes" : "UNVERIFIED notes — treat as tentative"})`,
    `Focus: ${bank.focus}`,
    bank.mandarin && bank.mandarin !== "none" ? `Mandarin: ${bank.mandarin} for this bank.` : "",
    bank.process ? `Process (verified): ${bank.process}` : "",
    bank.style_notes ? `Style notes: ${bank.style_notes}` : "",
  ].filter(Boolean).join("\n");
}

// ---- robust JSON extraction ------------------------------------------------

function parseJSON<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const arrStart = body.indexOf("[");
  const begin = arrStart >= 0 && (start < 0 || arrStart < start) ? arrStart : start;
  const lastObj = body.lastIndexOf("}");
  const lastArr = body.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);
  if (begin < 0 || end < 0) throw new Error("No JSON found in model output:\n" + text.slice(0, 400));
  return JSON.parse(body.slice(begin, end + 1)) as T;
}

async function callJSON<T>(tier: Tier, system: string, user: string, maxTokens?: number): Promise<T> {
  const out = await chat({ tier, system, user, maxTokens });
  return parseJSON<T>(out);
}

// ---- question generation (§5.1) --------------------------------------------

const STAGE_SPEC: Record<Stage, string> = {
  hirevue:
    "Stage A — async one-way video screen (HireVue). One question at a time, timed, no follow-ups. Mostly motivational/fit and behavioral (STAR). Optionally ONE light technical or brainteaser. Tests composure + tight structured delivery + motivational fit (Why IB / Why firm / Why HK).",
  first_round:
    "Stage B — live first round with an analyst/associate. Mixed behavioral + technical + fit. Technicals span accounting/valuation/M&A/LBO at the candidate's level. (Adaptive follow-ups are handled separately by the defensibility probe.)",
  superday:
    "Stage C — superday with multiple personas. Include: a deal/stock-pitch walk-through (the candidate's CATL pitch), deeper chained technicals, at least one brainteaser/market question, and harder behavioral/fit. Assign each question a persona: 'Friendly analyst', 'Skeptical VP', or 'Stress-testing MD'.",
};

export async function generateQuestions(opts: {
  stage: Stage; bankName?: string; count?: number;
}): Promise<GenQuestion[]> {
  const bank = opts.bankName ? getBank(opts.bankName) : null;
  const count = opts.count ?? (opts.stage === "hirevue" ? 3 : opts.stage === "first_round" ? 5 : 6);
  const real = bank ? realQuestionsFor(bank.name, opts.stage) : [];

  const system = `You are an elite Hong Kong IB interviewer generating realistic interview questions for ONE candidate.
${INTEGRITY}
Cross-cutting HK layer: surface Why-HK-over-NY/London, language ability, and China/cross-border awareness where natural; treat the candidate's EN/ZH bilingualism as an asset to probe.
Output STRICT JSON only: an array of objects {"prompt": string, "kind": "fit"|"behavioral"|"technical"|"pitch"|"brainteaser", "topicTags": string[], "persona"?: string}. No prose, no markdown.`;

  const user = `${STAGE_SPEC[opts.stage]}

Generate exactly ${count} questions for this stage, tailored to the candidate and the bank.

=== BANK ===
${bankContext(bank)}

=== CANDIDATE PROFILE ===
${doc("profile")}

=== CANDIDATE STORY BANK (their prepared answers — base behavioral/fit/pitch questions on what is actually here) ===
${doc("story_bank")}

=== TECHNICAL LEVEL (draw technicals from here; weak/review topics worth probing: ${weakTopics().join(", ") || "n/a"}) ===
${doc("hirevue_notes") ? "" : ""}${db.prepare("SELECT category, topic, mastery FROM technical_topics").all().map((t: any) => `${t.category}/${t.topic} [${t.mastery}]`).join("; ")}

${real.length ? `=== REAL QUESTIONS this bank/stage has actually used (you MAY reuse or adapt these; do NOT invent similar "real" claims) ===\n${real.map((q) => "- " + q).join("\n")}` : ""}

Mix the kinds appropriately for the stage. Keep prompts in the interviewer's voice, concise.`;

  const arr = await callJSON<GenQuestion[]>("generation", system, user, 1600);
  return arr.map((q) => ({
    prompt: String(q.prompt ?? "").trim(),
    kind: (DIMENSIONS[q.kind as RubricKind] ? q.kind : "behavioral") as RubricKind,
    topicTags: Array.isArray(q.topicTags) ? q.topicTags.map(String) : [],
    persona: q.persona ? String(q.persona) : undefined,
  })).filter((q) => q.prompt);
}

// ---- grading (§6) ----------------------------------------------------------

export async function gradeAnswer(opts: {
  question: string; kind: RubricKind; answer: string; bankName?: string; topicTags?: string[];
}): Promise<Grade> {
  const bank = opts.bankName ? getBank(opts.bankName) : null;
  const dims = DIMENSIONS[opts.kind];

  const rubricNote: Record<RubricKind, string> = {
    technical: "Flag any answer that is directionally right but could not survive one follow-up. 'defensibility' = survives a probe.",
    behavioral: "Score STAR completeness and specificity (concrete detail vs vague). Check consistency with the candidate's stored stories; flag contradictions.",
    fit: "Generic answers score LOW on 'specificity'. Reward specificity to THIS firm and to Hong Kong, and coherence with the candidate's cross-border thesis. 'red_flag_check' = penalize rehearsed/contradictory/cliched. Score it 1 (many red flags) to 5 (none).",
    pitch: "Probe thesis clarity, depth, risk-awareness, and valuation grounding. The followup MUST be a 'what would change your mind?' style stress test.",
    brainteaser: "Judge the approach and composure as much as the final number.",
  };

  const system = `You are a tough-but-fair elite Hong Kong IB interviewer grading ONE candidate answer.
${INTEGRITY}
Grade ONLY against the rubric. Be specific and honest — a weak answer gets low scores. If the answer asserts a figure or claim that contradicts the candidate's own profile/story bank, add a flag. If a stated number is something the candidate must be able to defend (e.g. a backtest metric, a valuation output), and the answer doesn't show they can, flag it.
Output STRICT JSON only:
{
 "dimensions": [ ${dims.map((d) => `{"name":"${d}","score":1-5,"justification":"one line"}`).join(", ")} ],
 "overall": 1-5,
 "followup": "the single hardest follow-up an interviewer would ask next (one sentence)",
 "modelAnswer": "a concise, defensible model answer (3-6 sentences)",
 "flags": ["any integrity/uncertainty/inconsistency flags, or empty"],
 "topicTags": ["short tags for weak-spot tracking"]
}`;

  const user = `RUBRIC: ${opts.kind} — dimensions: ${dims.join(", ")}.
${rubricNote[opts.kind]}

=== BANK CONTEXT ===
${bankContext(bank)}

=== CANDIDATE PROFILE (for consistency checks) ===
${doc("profile")}

=== CANDIDATE STORY BANK (their canonical answers — check consistency) ===
${doc("story_bank")}

=== QUESTION ===
${opts.question}

=== CANDIDATE'S ANSWER ===
${opts.answer || "(no answer given)"}

Grade now.`;

  const g = await callJSON<Grade>("grading", system, user, 2000);
  // normalize
  g.dimensions = (g.dimensions ?? []).map((d) => ({ name: String(d.name), score: clamp(d.score), justification: String(d.justification ?? "") }));
  g.overall = clamp(g.overall ?? avg(g.dimensions.map((d) => d.score)));
  g.flags = Array.isArray(g.flags) ? g.flags.map(String) : [];
  g.topicTags = Array.isArray(g.topicTags) ? g.topicTags.map(String) : (opts.topicTags ?? []);
  g.followup = String(g.followup ?? "");
  g.modelAnswer = String(g.modelAnswer ?? "");
  return g;
}

// ---- defensibility probe (§5.5) -------------------------------------------

export async function judgeProbe(opts: {
  topic: string; question: string; followup: string; answer: string;
}): Promise<{ survived: boolean; verdict: string }> {
  const system = `You are an elite IB interviewer judging whether a candidate's answer to the single hardest follow-up SURVIVES — i.e. shows real understanding, defensible one sentence further.
${INTEGRITY}
Output STRICT JSON only: {"survived": true|false, "verdict": "one or two sentences"}. Default to survived=false if the answer is vague, evasive, or only restates the original.`;
  const user = `Topic: ${opts.topic}
Original question: ${opts.question}
The hardest follow-up asked: ${opts.followup}
Candidate's answer to the follow-up: ${opts.answer || "(no answer)"}

Judge.`;
  const r = await callJSON<{ survived: boolean; verdict: string }>("grading", system, user, 600);
  return { survived: Boolean(r.survived), verdict: String(r.verdict ?? "") };
}

// ---- resume-claim interrogation (§5.6) ------------------------------------

export interface ResumeClaim { claim: string; hardestQuestion: string; whatWeakLooksLike: string; risk: "high" | "medium" | "low"; kind: RubricKind; }

export async function interrogateResume(): Promise<ResumeClaim[]> {
  const system = `You are an elite IB interviewer. Read the candidate's resume/profile and story bank, and for EVERY substantive claim a banker could attack, produce the single hardest question that probes whether the candidate really understands/defends it.
${INTEGRITY}
Pay attention to items the candidate themselves flagged as risks (e.g. an AI-assisted build they must defend by design decisions). Do not invent achievements.
Output STRICT JSON only: an array of {"claim": string, "hardestQuestion": string, "whatWeakLooksLike": string, "risk": "high"|"medium"|"low", "kind": "technical"|"behavioral"|"fit"|"pitch"}. Pick "kind" by how the answer should be graded (e.g. a DCF/model claim -> technical; a leadership claim -> behavioral; the CATL thesis -> pitch). 8-14 items.`;
  const user = `=== PROFILE ===\n${doc("profile")}\n\n=== STORY BANK ===\n${doc("story_bank")}`;
  const arr = await callJSON<ResumeClaim[]>("generation", system, user, 2400);
  return arr.map((c) => ({
    claim: String(c.claim ?? ""),
    hardestQuestion: String(c.hardestQuestion ?? ""),
    whatWeakLooksLike: String(c.whatWeakLooksLike ?? ""),
    risk: (["high", "medium", "low"].includes(c.risk) ? c.risk : "medium") as ResumeClaim["risk"],
    kind: (DIMENSIONS[c.kind as RubricKind] ? c.kind : "technical") as RubricKind,
  })).filter((c) => c.claim && c.hardestQuestion);
}

// ---- helpers ---------------------------------------------------------------

function clamp(n: any): number { const x = Math.round(Number(n)); return Math.max(1, Math.min(5, isFinite(x) ? x : 3)); }
function avg(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 3; }
