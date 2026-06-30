import { useState } from "react";
import { getResumeClaims, gradeAnswer, type ResumeClaim, type Grade } from "../api.js";
import { AnswerInput } from "../components/AnswerInput.js";
import { RubricCard } from "../components/RubricCard.js";

const riskColor: Record<string, string> = {
  high: "bg-red-100 text-red-800", medium: "bg-amber-100 text-amber-800", low: "bg-slate-100 text-slate-600",
};

export function ResumeDrill() {
  const [claims, setClaims] = useState<ResumeClaim[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr(null); setLoading(true);
    try { setClaims((await getResumeClaims()).claims); }
    catch (e) { setErr(String(e)); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Resume-claim interrogation</h2>
        <p className="text-sm text-slate-500">
          The single hardest question on every claim in your resume + story bank — so nothing on it is undefendable.
          Answers are graded for consistency with your stored material.
        </p>
        <button onClick={load} disabled={loading}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Interrogating…" : claims ? "Regenerate" : "Generate hardest questions"}
        </button>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {claims?.map((c, i) => <ClaimCard key={i} claim={c} />)}
    </div>
  );
}

function ClaimCard({ claim }: { claim: ResumeClaim }) {
  const [draft, setDraft] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function grade_() {
    setErr(null); setBusy(true);
    try {
      const { grade } = await gradeAnswer({ question: claim.hardestQuestion, kind: claim.kind, answer: draft });
      setGrade(grade);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-800">{claim.claim}</p>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${riskColor[claim.risk]}`}>{claim.risk} risk</span>
      </div>
      <p className="mt-2 text-sm text-slate-700"><span className="font-medium">Hardest Q:</span> {claim.hardestQuestion}</p>
      <p className="mt-1 text-xs text-slate-500"><span className="font-medium">Weak answer looks like:</span> {claim.whatWeakLooksLike}</p>

      {!grade && (
        <div className="mt-3">
          {!open ? (
            <button onClick={() => setOpen(true)} className="text-sm text-blue-600 underline">Drill this claim →</button>
          ) : (
            <div className="space-y-2">
              <AnswerInput value={draft} onChange={setDraft} placeholder="Defend the claim…" />
              <button onClick={grade_} disabled={busy}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "Grading…" : "Grade my defense"}
              </button>
            </div>
          )}
        </div>
      )}
      {err && <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{err}</div>}
      {grade && <div className="mt-3"><RubricCard question={claim.hardestQuestion} kind={claim.kind} answer={draft} grade={grade} /></div>}
    </div>
  );
}
