import { useEffect, useState } from "react";
import { getProgress, type Progress as P } from "../api.js";

const masteryColor: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800", shaky: "bg-amber-100 text-amber-800", review: "bg-red-100 text-red-800",
};
const stageLabel: Record<string, string> = {
  hirevue: "HireVue (A)", first_round: "First round (B)", superday: "Superday (C)",
};

export function Progress() {
  const [p, setP] = useState<P | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { getProgress().then(setP).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>;
  if (!p) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Readiness by stage</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {["hirevue", "first_round", "superday"].map((st) => {
            const row = p.byStage.find((r) => r.stage === st);
            return (
              <div key={st} className="rounded-lg border bg-white p-4">
                <div className="text-sm text-slate-500">{stageLabel[st]}</div>
                <div className="text-2xl font-semibold">{row?.avg_overall ? row.avg_overall.toFixed(1) : "—"}<span className="text-sm text-slate-400">/5</span></div>
                <div className="text-xs text-slate-400">{row?.attempts ?? 0} attempts</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Readiness by bank</h2>
        {p.byBank.length === 0 ? (
          <p className="text-sm text-slate-500">No graded bank sessions yet — run a mock to populate this.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {p.byBank.map((b) => (
              <div key={b.bank} className="flex items-center justify-between rounded-lg border bg-white px-4 py-2 text-sm">
                <span>{b.bank}</span>
                <span className="font-semibold">{b.avg_overall ? b.avg_overall.toFixed(1) : "—"}/5 <span className="text-xs text-slate-400">({b.attempts})</span></span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Technical weak spots</h2>
        <div className="flex flex-wrap gap-2">
          {p.topics.map((t) => (
            <span key={t.topic} className={`rounded px-2 py-1 text-xs ${masteryColor[t.mastery] ?? "bg-slate-100"}`}>
              {t.topic} · {t.mastery}{t.verified ? "" : " ?"}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Due for review (spaced repetition)</h2>
        {p.dueReviews.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing due. Low-scoring answers (≤2/5) get resurfaced here.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {p.dueReviews.map((r) => (
              <li key={r.id} className="rounded border bg-white px-3 py-2">
                <span className="text-xs uppercase text-slate-400">{r.rubric_kind}</span> — {r.question ?? "(item)"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
