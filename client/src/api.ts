export interface Bank {
  name: string;
  tier: string;
  focus: string;
  funnel_stage: string;
  mandarin?: string;
  competition?: number;
  match?: number;
  style_notes: string;
  verified: boolean;
}

export interface Status {
  banks: number;
  verifiedBanks: number;
  topics: number;
  realQuestions: number;
  docsNeedingInput: string[];
  ai: { provider: string; grading_model: string; generation_model: string; key_present: boolean };
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export const getStatus = () => get<Status>("/api/status");
export const getBanks = () => get<Bank[]>("/api/banks");
