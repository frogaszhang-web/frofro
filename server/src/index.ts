import "dotenv/config";
import express from "express";
import cors from "cors";
import db from "./db.js";
import { seedAll } from "./seed.js";
import { aiConfig } from "./ai.js";
import { router as apiRouter } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Auto-seed on first boot so the app runs before `npm run seed` is called.
const bankCount = (db.prepare("SELECT COUNT(*) AS n FROM banks").get() as { n: number }).n;
if (bankCount === 0) {
  const r = seedAll();
  console.log(`[seed] first boot: ${r.banks} banks, ${r.topics} topics, ${r.realQuestions} real questions, ${r.techBank} answer-keyed drill questions`);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: aiConfig() });
});

// Readiness/status: what's seeded and what still has [TODO] personal data.
app.get("/api/status", (_req, res) => {
  const banks = (db.prepare("SELECT COUNT(*) AS n FROM banks").get() as { n: number }).n;
  const verifiedBanks = (db.prepare("SELECT COUNT(*) AS n FROM banks WHERE verified=1").get() as { n: number }).n;
  const topics = (db.prepare("SELECT COUNT(*) AS n FROM technical_topics").get() as { n: number }).n;
  const realQuestions = (db.prepare("SELECT COUNT(*) AS n FROM real_questions").get() as { n: number }).n;
  const technicalBank = (db.prepare("SELECT COUNT(*) AS n FROM technical_bank").get() as { n: number }).n;
  const references = (db.prepare("SELECT COUNT(*) AS n FROM references_doc").get() as { n: number }).n;
  const docs = db.prepare("SELECT key, has_todo FROM docs").all() as { key: string; has_todo: number }[];
  res.json({
    banks,
    verifiedBanks,
    topics,
    realQuestions,
    technicalBank,
    references,
    docsNeedingInput: docs.filter((d) => d.has_todo).map((d) => d.key),
    ai: aiConfig(),
  });
});

app.get("/api/banks", (_req, res) => {
  const rows = db.prepare("SELECT json FROM banks ORDER BY match_score DESC NULLS LAST, name").all() as { json: string }[];
  res.json(rows.map((r) => JSON.parse(r.json)));
});

app.get("/api/banks/:name", (req, res) => {
  const row = db.prepare("SELECT json FROM banks WHERE name = ?").get(req.params.name) as { json: string } | undefined;
  if (!row) return res.status(404).json({ error: "bank not found" });
  res.json(JSON.parse(row.json));
});

app.get("/api/profile", (_req, res) => {
  const row = db.prepare("SELECT content FROM docs WHERE key = 'profile'").get() as { content: string } | undefined;
  res.json({ content: row?.content ?? "" });
});

app.get("/api/topics", (_req, res) => {
  res.json(db.prepare("SELECT * FROM technical_topics ORDER BY category, id").all());
});

// Stage runners, grading, defensibility, resume interrogation, progress.
app.use("/api", apiRouter);

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  const cfg = aiConfig();
  console.log(`[crucible] server on http://localhost:${PORT}`);
  console.log(`[crucible] AI provider=${cfg.provider} grading=${cfg.grading_model} generation=${cfg.generation_model} key=${cfg.key_present ? "set" : "MISSING"}`);
});
