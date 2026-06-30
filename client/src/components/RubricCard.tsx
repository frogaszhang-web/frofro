import type { Grade } from "../api.js";

const scoreColor = (s: number) =>
  s >= 4 ? "bg-emerald-100 text-emerald-800" : s >= 3 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";

export function RubricCard({ question, kind, answer, grade }: {
  question: string; kind: string; answer?: string; grade: Grade;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-800">{question}</p>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${scoreColor(grade.overall)}`}>
          {grade.overall}/5
        </span>
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{kind}</div>

      {answer !== undefined && (
        <details className="mt-2 text-xs text-slate-500">
          <summary className="cursor-pointer">your answer</summary>
          <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2">{answer || "(no answer)"}</p>
        </details>
      )}

      <div className="mt-3 space-y-1.5">
        {grade.dimensions.map((d) => (
          <div key={d.name} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 w-6 shrink-0 rounded text-center text-xs font-bold ${scoreColor(d.score)}`}>{d.score}</span>
            <span className="text-slate-700">
              <span className="font-medium capitalize">{d.name.replace(/_/g, " ")}</span> — <span className="text-slate-500">{d.justification}</span>
            </span>
          </div>
        ))}
      </div>

      {grade.flags?.length > 0 && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          ⚠ {grade.flags.join(" · ")}
        </div>
      )}

      <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
        <p className="font-medium text-slate-700">Hardest follow-up they'd ask:</p>
        <p className="text-slate-600">{grade.followup}</p>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-medium text-blue-700">Model answer</summary>
        <p className="mt-1 whitespace-pre-wrap text-slate-600">{grade.modelAnswer}</p>
      </details>
    </div>
  );
}
