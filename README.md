# Crucible — IB Interview Prep (HK Summer Analyst 2027)

A local-first web app that drills you across the **entire** Hong Kong IB recruiting
funnel — async video screen, live first round, and superday — for every bank in your
tracker, tailored to your resume, story bank, and the HK cross-border M&A market.

> **Status: v1 scaffold (Phase 2 complete).** The data layer, all 32 verified banks,
> the model-agnostic AI layer, and a runnable client/server are in place. The graded
> stage runners (HireVue / first round / superday), the defensibility drill, and the
> resume-claim interrogation are built in Phase 3 — **after** you fill the personal
> `[TODO]` fields in `/data`.

---

## Setup

Requires **Node 20+** and **npm**. From the repo root:

```bash
npm install              # installs server + client workspaces
cp .env.example .env      # then edit .env (see below)
npm run seed             # loads /data into the local SQLite db
npm run dev              # starts server (:4000) + client (:5173)
```

Open **http://localhost:5173**.

### One-command dev
`npm run dev` runs the Express API and the Vite client together. The client proxies
`/api/*` to the server, so you only open the client URL.

---

## Environment (`.env`)

| Var | Meaning |
|---|---|
| `AI_PROVIDER` | `anthropic` (pay-as-you-go API) or `local` (Ollama-style, $0 runtime) |
| `ANTHROPIC_API_KEY` | Your key from [console.anthropic.com](https://console.anthropic.com) |
| `ANTHROPIC_GRADING_MODEL` | Default `claude-sonnet-4-6` (grading quality) |
| `ANTHROPIC_GENERATION_MODEL` | Default `claude-haiku-4-5` (cheap question generation) |
| `LOCAL_BASE_URL` / `LOCAL_*_MODEL` | For `AI_PROVIDER=local` (e.g. Ollama) |
| `PORT` | Server port (default 4000) |

### Costs & API key — read this
This app calls the **Anthropic Developer API**, billed **pay-as-you-go per token**.
**It is NOT covered by a Claude Max/Pro subscription** — those cover Claude.ai and
Claude Code only. You need your own API key with billing set up, and you should set a
**monthly spend cap** in the Console. Rough cost: grading is a few cents per answer;
a heavy prep week is a few dollars. If you want **$0 runtime**, set `AI_PROVIDER=local`
and point it at a local model (quality drops, but no API spend).

---

## Data files (`/data`) — the source of truth

These plain files are seeded into SQLite by `npm run seed`. Edit them, then re-seed.

| File | What it holds | Who fills it |
|---|---|---|
| `banks.json` | The 32 banks (tier, focus, **verified** recruiting process, Mandarin flag, style notes). Pre-built from your tracker. | Pre-filled; verify ⚠️ entries |
| `profile.md` | Your resume/background. Has `[TODO]`/`[CONFIRM]`. | **You** |
| `story_bank.md` | STAR stories, Why-X answers, the CATL pitch, resume-claim defenses. Has `[TODO]`. | **You** |
| `technical_topics.md` | Technicals you've covered + mastery per line. | You refine |
| `hirevue_notes.md` | JPM HireVue format (3 Q, 30s prep / 120s answer, no re-records). | Mostly filled |
| `real_questions.md` | Real questions you/peers hit. Empty is fine. | You, if available |

**Format notes:** `banks.json` is the schema-of-record (see its `_meta`). In
`technical_topics.md`, each topic bullet ends with `· mastery: strong\|shaky\|review ·
verified: true\|false` — the seeder parses that. In `real_questions.md`, entries follow
`- bank: X · stage: Y · question: "..." · source: Z · date: YYYY-MM-DD`.

**Integrity:** nothing personal or firm-specific is invented. `verified: false` on a
bank means the tracker marked it ⚠️ (needs confirmation). `[VERIFY]` markers (e.g. the
CATL listing date / JPM's bookrunner role) are flagged, not asserted.

---

## How to use this for the JPM HireVue this week

1. **Fill `story_bank.md`** — at minimum: Why IB, Why JPM, Why Hong Kong, your two STAR
   stories, and the CATL pitch. These are what the HireVue tests. (Confirm the
   `[VERIFY]` CATL date / JPM role — it's a credibility item.)
2. **Fill the `[CONFIRM]` lines in `profile.md`** (GPA, dates, BMC status).
3. `npm run seed` to load them.
4. Run **Stage A (HireVue mode)** for JPMorgan *(Phase 3)*: one question at a time,
   **30s prep → 120s answer, one shot, no re-records** — exactly the real format.
   Speak your answer (mic transcription) or type it; it grades against the fit/behavioral
   rubric, gives the exact follow-up an interviewer would ask, and a model answer.
5. Drill until Why-JPM and Why-HK are tight and you can deliver STAR in 120s without
   rambling. JPM's China Coverage group prizes Mandarin + China experience — lean into it.

---

## Smoke test

```bash
npm run smoke
```

Confirms the data seeds and (if `ANTHROPIC_API_KEY` is set) does one live AI round-trip.
Without a key it seeds and reports config, skipping the API call.

---

## Architecture

```
data/            editable source files -> seeded into SQLite (data/crucible.db)
server/  Express + better-sqlite3 + model-agnostic AI layer (ai.ts)
client/  React + Vite + Tailwind
```
All AI calls go through `server/src/ai.ts` (provider-swappable). The API key never
reaches the browser. No cloud database, no telemetry.

## Open questions for you
- The brief mentions **33** banks; your tracker has **32**. Add the 33rd to `banks.json`
  if you have it.
- Confirm the ⚠️ `verified: false` banks (Evercore, Moelis, Mizuho, Daiwa, SMBC, and the
  three deep-safety Chinese houses) when you can.
- Fill the personal `[TODO]`/`[CONFIRM]`/`[VERIFY]` fields so Phase 3 grading is grounded
  in your real material.
