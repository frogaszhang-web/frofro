import { useEffect, useState } from "react";
import { getBanks, getStatus, type Bank, type Status } from "./api.js";
import { HireVue } from "./modes/HireVue.js";
import { LiveRound } from "./modes/LiveRound.js";
import { ResumeDrill } from "./modes/ResumeDrill.js";
import { Progress } from "./modes/Progress.js";

type Tab = "home" | "hirevue" | "first_round" | "superday" | "resume" | "progress";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "hirevue", label: "HireVue (A)" },
  { id: "first_round", label: "First round (B)" },
  { id: "superday", label: "Superday (C)" },
  { id: "resume", label: "Resume drill" },
  { id: "progress", label: "Progress" },
];

const tierColor: Record<string, string> = {
  BB: "bg-blue-100 text-blue-800", EB: "bg-purple-100 text-purple-800",
  MM: "bg-amber-100 text-amber-800", boutique: "bg-emerald-100 text-emerald-800",
};

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [status, setStatus] = useState<Status | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStatus(), getBanks()])
      .then(([s, b]) => { setStatus(s); setBanks(b); })
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-semibold">Crucible</h1>
          <p className="text-sm text-slate-500">HK IB Summer Analyst 2027 — full-funnel interview drill</p>
          <nav className="mt-3 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {err && <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">API unreachable: {err}. Is the server on :4000?</div>}

        {!status?.ai.key_present && status?.ai.provider === "anthropic" && tab !== "home" && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No <code>ANTHROPIC_API_KEY</code> set — generation/grading will fail. Add it to <code>.env</code> (or set <code>AI_PROVIDER=local</code>).
          </div>
        )}

        {tab === "home" && <Home status={status} banks={banks} />}
        {tab === "hirevue" && <HireVue banks={banks} />}
        {tab === "first_round" && <LiveRound banks={banks} stage="first_round" />}
        {tab === "superday" && <LiveRound banks={banks} stage="superday" />}
        {tab === "resume" && <ResumeDrill />}
        {tab === "progress" && <Progress />}
      </main>
    </div>
  );
}

function Home({ status, banks }: { status: Status | null; banks: Bank[] }) {
  return (
    <div className="space-y-8">
      {status && (
        <section className="grid gap-4 sm:grid-cols-4">
          <Stat label="Banks seeded" value={`${status.banks}`} sub={`${status.verifiedBanks} verified`} />
          <Stat label="Drill bank" value={`${status.technicalBank ?? 0}`} sub="technical Qs (keyed + reference)" />
          <Stat label="Technical topics" value={`${status.topics}`} />
          <Stat label="AI provider" value={status.ai.provider} sub={status.ai.key_present ? "key set" : "no key"} />
        </section>
      )}

      {status && status.docsNeedingInput.length > 0 && (
        <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Files in <code>/data</code> still have TODO/CONFIRM/VERIFY markers:</p>
          <p className="mt-1">
            {status.docsNeedingInput.map((d) => <code key={d} className="mx-1 rounded bg-amber-100 px-1">{d}.md</code>)}
            — fill remaining personal fields and run <code>npm run seed</code> to sharpen grading.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Target banks ({banks.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {banks.map((b) => (
            <div key={b.name} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{b.name}</h3>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${tierColor[b.tier] ?? "bg-slate-100"}`}>{b.tier}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{b.focus}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                {typeof b.match === "number" && <span>match {b.match}/10</span>}
                {b.mandarin && b.mandarin !== "none" && <span>· 中文 {b.mandarin}</span>}
                <span>· {b.funnel_stage}</span>
                {!b.verified && <span className="text-amber-600">· unverified</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
