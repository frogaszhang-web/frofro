import { useState } from "react";
import { startSession, gradeAnswer, probe, finishSession, type Bank, type Question, type Grade, type Stage } from "../api.js";
import { AnswerInput } from "../components/AnswerInput.js";
import { RubricCard } from "../components/RubricCard.js";
import { BankPicker } from "../components/BankPicker.js";

type Phase = "setup" | "answering" | "graded" | "probed" | "done";

const personaColor: Record<string, string> = {
  "Friendly analyst": "bg-emerald-100 text-emerald-800",
  "Skeptical VP": "bg-amber-100 text-amber-800",
  "Stress-testing MD": "bg-red-100 text-red-800",
};

export function LiveRound({ banks, stage }: { banks: Bank[]; stage: Stage }) {
  const isSuperday = stage === "superday";
  const [bank, setBank] = useState(isSuperday ? "China Renaissance" : "JPMorgan");
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [probeDraft, setProbeDraft] = useState("");
  const [probeResult, setProbeResult] = useState<{ survived: boolean; verdict: string } | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setErr(null); setBusy(true);
    try {
      const s = await startSession(stage, bank);
      setSessionId(s.sessionId); setQuestions(s.questions);
      setIdx(0); setDraft(""); setGrade(null); setProbeDraft(""); setProbeResult(null); setScores([]);
      setPhase("answering");
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  const q = questions[idx];

  async function submitAnswer() {
    if (!q) return;
    setErr(null); setBusy(true);
    try {
      const { grade } = await gradeAnswer({
        sessionId: sessionId ?? undefined, question: q.prompt, kind: q.kind,
        answer: draft, bank, topicTags: q.topicTags,
      });
      setGrade(grade); setScores([...scores, grade.overall]); setPhase("graded");
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  async function submitProbe() {
    if (!q || !grade) return;
    setErr(null); setBusy(true);
    try {
      const r = await probe({
        topic: q.topicTags[0] ?? q.kind, question: q.prompt, followup: grade.followup, answer: probeDraft,
      });
      setProbeResult(r); setPhase("probed");
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  async function next() {
    setDraft(""); setGrade(null); setProbeDraft(""); setProbeResult(null);
    if (idx + 1 < questions.length) { setIdx(idx + 1); setPhase("answering"); }
    else { if (sessionId) await finishSession(sessionId); setPhase("done"); }
  }

  const title = isSuperday ? "Superday / assessment centre (Stage C)" : "First round — live (Stage B)";
  const sub = isSuperday
    ? "Multiple personas · deal/pitch walk-through · chained technicals · brainteaser · harder fit."
    : "Conversational · mixed behavioral + technical + fit · one adaptive follow-up per answer.";
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">{sub}</p>
        {phase === "setup" && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BankPicker banks={banks} value={bank} onChange={setBank} />
            <button onClick={start} disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "Generating…" : "Start round"}
            </button>
          </div>
        )}
        {phase !== "setup" && phase !== "done" && (
          <p className="mt-2 text-sm text-slate-500">Question {idx + 1} of {questions.length} · {bank}</p>
        )}
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {q && phase !== "setup" && phase !== "done" && (
        <div className="rounded-lg border bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-500">{q.kind}</span>
            {q.persona && <span className={`rounded px-2 py-0.5 text-xs font-medium ${personaColor[q.persona] ?? "bg-slate-100"}`}>{q.persona}</span>}
          </div>
          <p className="mt-2 text-lg font-medium text-slate-800">{q.prompt}</p>

          {phase === "answering" && (
            <div className="mt-4 space-y-3">
              <AnswerInput value={draft} onChange={setDraft} />
              <button onClick={submitAnswer} disabled={busy}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "Grading…" : "Submit answer"}
              </button>
            </div>
          )}

          {(phase === "graded" || phase === "probed") && grade && (
            <div className="mt-4 space-y-4">
              <RubricCard question={q.prompt} kind={q.kind} grade={grade} />

              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-800">One-sentence-deeper drill</p>
                <p className="mt-1 text-sm text-slate-700">{grade.followup}</p>
                {phase === "graded" && (
                  <div className="mt-3 space-y-2">
                    <AnswerInput value={probeDraft} onChange={setProbeDraft} placeholder="Defend it one sentence deeper…" />
                    <button onClick={submitProbe} disabled={busy}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                      {busy ? "Judging…" : "Submit follow-up"}
                    </button>
                  </div>
                )}
                {phase === "probed" && probeResult && (
                  <div className={`mt-3 rounded p-3 text-sm ${probeResult.survived ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    <span className="font-semibold">{probeResult.survived ? "✓ Survived the probe" : "✗ Did not survive — topic flagged for review"}</span>
                    <p className="mt-1">{probeResult.verdict}</p>
                  </div>
                )}
              </div>

              {phase === "probed" && (
                <button onClick={next} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">
                  {idx + 1 < questions.length ? "Next question →" : "Finish round"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="rounded-lg border bg-white p-5">
          <span className="text-sm text-slate-500">Round average</span>
          <div className="text-3xl font-semibold">{avg}<span className="text-base text-slate-400">/5</span></div>
          <button onClick={() => setPhase("setup")} className="mt-2 text-sm text-blue-600 underline">Run another round</button>
        </div>
      )}
    </div>
  );
}
