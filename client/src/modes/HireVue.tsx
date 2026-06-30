import { useState } from "react";
import { startSession, gradeAnswer, finishSession, type Bank, type Question, type Grade } from "../api.js";
import { Timer } from "../components/Timer.js";
import { AnswerInput } from "../components/AnswerInput.js";
import { RubricCard } from "../components/RubricCard.js";
import { BankPicker } from "../components/BankPicker.js";

type Phase = "setup" | "prep" | "answer" | "grading" | "results";
const PREP = 30, ANSWER = 120;

export function HireVue({ banks }: { banks: Bank[] }) {
  const [bank, setBank] = useState("JPMorgan");
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setErr(null); setLoading(true);
    try {
      const s = await startSession("hirevue", bank);
      setSessionId(s.sessionId);
      setQuestions(s.questions);
      setAnswers([]); setIdx(0); setDraft(""); setGrades([]);
      setPhase("prep");
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  function lockAnswer() {
    const all = [...answers, draft];
    setAnswers(all);
    setDraft("");
    if (idx + 1 < questions.length) { setIdx(idx + 1); setPhase("prep"); }
    else gradeAll(all);
  }

  async function gradeAll(all: string[]) {
    setPhase("grading"); setErr(null);
    try {
      const out: Grade[] = [];
      for (let i = 0; i < questions.length; i++) {
        const { grade } = await gradeAnswer({
          sessionId: sessionId ?? undefined, question: questions[i].prompt,
          kind: questions[i].kind, answer: all[i] ?? "", bank, topicTags: questions[i].topicTags,
        });
        out.push(grade);
        setGrades([...out]);
      }
      if (sessionId) await finishSession(sessionId);
      setPhase("results");
    } catch (e) { setErr(String(e)); setPhase("results"); }
  }

  const q = questions[idx];
  const avg = grades.length ? (grades.reduce((a, g) => a + g.overall, 0) / grades.length).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">HireVue — async video screen (Stage A)</h2>
        <p className="text-sm text-slate-500">
          One question at a time · {PREP}s prep → {ANSWER}s answer · no re-records. Exactly the real JPM format.
        </p>
        {phase === "setup" && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BankPicker banks={banks} value={bank} onChange={setBank} />
            <button onClick={start} disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {loading ? "Generating questions…" : "Start screen"}
            </button>
          </div>
        )}
        {phase !== "setup" && phase !== "results" && (
          <p className="mt-2 text-sm text-slate-500">Question {idx + 1} of {questions.length} · {bank}</p>
        )}
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {(phase === "prep" || phase === "answer") && q && (
        <div className="rounded-lg border bg-white p-5">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-500">{q.kind}</span>
          <p className="mt-2 text-lg font-medium text-slate-800">{q.prompt}</p>

          {phase === "prep" && (
            <div className="mt-4 space-y-3">
              <Timer key={`prep-${idx}`} seconds={PREP} label="Prep — think, don't speak yet" onDone={() => setPhase("answer")} />
              <p className="text-sm text-slate-500">Structure a point-first answer. The answer window starts automatically.</p>
              <button onClick={() => setPhase("answer")} className="text-sm text-blue-600 underline">Skip prep →</button>
            </div>
          )}

          {phase === "answer" && (
            <div className="mt-4 space-y-3">
              <Timer key={`answer-${idx}`} seconds={ANSWER} label="Answer — one shot, no re-records" onDone={lockAnswer} />
              <AnswerInput value={draft} onChange={setDraft} placeholder="Speak your answer (mic) or type…" />
              <button onClick={lockAnswer} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">
                Submit answer (locks it)
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "grading" && (
        <div className="rounded-lg border bg-white p-5 text-sm text-slate-600">
          Grading your answers… ({grades.length}/{questions.length})
        </div>
      )}

      {phase === "results" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <span className="text-sm text-slate-500">Session average</span>
            <div className="text-3xl font-semibold">{avg}<span className="text-base text-slate-400">/5</span></div>
            <button onClick={() => setPhase("setup")} className="mt-2 text-sm text-blue-600 underline">Run another screen</button>
          </div>
          {grades.map((g, i) => (
            <RubricCard key={i} question={questions[i].prompt} kind={questions[i].kind} answer={answers[i]} grade={g} />
          ))}
        </div>
      )}
    </div>
  );
}
