import { Router } from "express";
import db from "./db.js";
import {
  generateQuestions, gradeAnswer, judgeProbe, interrogateResume,
  type Stage, type RubricKind,
} from "./engine.js";

export const router = Router();

const now = () => new Date().toISOString();
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

// ---- start a mock session: returns generated questions ---------------------
router.post("/session/start", async (req, res) => {
  try {
    const stage = req.body.stage as Stage;
    const bank = req.body.bank as string | undefined;
    if (!["hirevue", "first_round", "superday"].includes(stage)) {
      return res.status(400).json({ error: "invalid stage" });
    }
    const info = db.prepare("INSERT INTO sessions (stage, bank, created_at) VALUES (?, ?, ?)")
      .run(stage, bank ?? null, now());
    const questions = await generateQuestions({ stage, bankName: bank, count: req.body.count });
    res.json({ sessionId: Number(info.lastInsertRowid), stage, bank: bank ?? null, questions });
  } catch (e) {
    console.error("[session/start]", e);
    res.status(500).json({ error: "generation failed", detail: String(e) });
  }
});

// ---- grade one answer; stores an attempt -----------------------------------
router.post("/grade", async (req, res) => {
  try {
    const { sessionId, question, kind, answer, bank, topicTags } = req.body as {
      sessionId?: number; question: string; kind: RubricKind; answer: string;
      bank?: string; topicTags?: string[];
    };
    if (!question || !kind) return res.status(400).json({ error: "question and kind required" });

    const grade = await gradeAnswer({ question, kind, answer: answer ?? "", bankName: bank, topicTags });

    const info = db.prepare(`
      INSERT INTO attempts (session_id, question, answer, rubric_kind, scores_json, followup, model_answer, topic_tags, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId ?? null, question, answer ?? "", kind,
      JSON.stringify(grade), grade.followup, grade.modelAnswer,
      JSON.stringify(grade.topicTags ?? []), now(),
    );

    // Spaced-repetition: schedule a review for weak answers.
    if (grade.overall <= 2) {
      db.prepare("INSERT INTO progress_queue (ref_type, ref_id, due_at, ease, last_score) VALUES ('attempt', ?, ?, 2.0, ?)")
        .run(Number(info.lastInsertRowid), plusDays(1), grade.overall);
    }
    res.json({ attemptId: Number(info.lastInsertRowid), grade });
  } catch (e) {
    console.error("[grade]", e);
    res.status(500).json({ error: "grading failed", detail: String(e) });
  }
});

// ---- defensibility probe: judge the follow-up answer -----------------------
router.post("/probe", async (req, res) => {
  try {
    const { topic, question, followup, answer } = req.body as {
      topic: string; question: string; followup: string; answer: string;
    };
    const r = await judgeProbe({ topic: topic ?? "", question, followup, answer: answer ?? "" });

    // If it didn't survive and we recognize the topic, auto-mark it 'review' (§ drill rule).
    if (!r.survived && topic) {
      db.prepare("UPDATE technical_topics SET mastery='review' WHERE topic = ?").run(topic);
    }
    res.json(r);
  } catch (e) {
    console.error("[probe]", e);
    res.status(500).json({ error: "probe failed", detail: String(e) });
  }
});

// ---- session detail --------------------------------------------------------
router.get("/session/:id", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "session not found" });
  const attempts = (db.prepare("SELECT * FROM attempts WHERE session_id = ? ORDER BY id").all(req.params.id) as any[])
    .map((a) => ({ ...a, scores: JSON.parse(a.scores_json), topic_tags: JSON.parse(a.topic_tags || "[]") }));
  res.json({ session, attempts });
});

// ---- finish a session: store summary score ---------------------------------
router.post("/session/:id/finish", (req, res) => {
  const rows = db.prepare("SELECT scores_json FROM attempts WHERE session_id = ?").all(req.params.id) as { scores_json: string }[];
  const overalls = rows.map((r) => JSON.parse(r.scores_json).overall).filter((n: any) => typeof n === "number");
  const summary = overalls.length ? overalls.reduce((a, b) => a + b, 0) / overalls.length : null;
  db.prepare("UPDATE sessions SET summary_score = ? WHERE id = ?").run(summary, req.params.id);
  res.json({ summary_score: summary, attempts: overalls.length });
});

// ---- resume-claim interrogation (§5.6) ------------------------------------
router.get("/resume-claims", async (_req, res) => {
  try {
    res.json({ claims: await interrogateResume() });
  } catch (e) {
    console.error("[resume-claims]", e);
    res.status(500).json({ error: "interrogation failed", detail: String(e) });
  }
});

// ---- progress / readiness dashboard (§5.7) ---------------------------------
router.get("/progress", (_req, res) => {
  const byStage = db.prepare(`
    SELECT s.stage AS stage, COUNT(a.id) AS attempts, AVG(json_extract(a.scores_json,'$.overall')) AS avg_overall
    FROM sessions s LEFT JOIN attempts a ON a.session_id = s.id
    GROUP BY s.stage
  `).all();

  const byBank = db.prepare(`
    SELECT s.bank AS bank, COUNT(a.id) AS attempts, AVG(json_extract(a.scores_json,'$.overall')) AS avg_overall
    FROM sessions s LEFT JOIN attempts a ON a.session_id = s.id
    WHERE s.bank IS NOT NULL
    GROUP BY s.bank ORDER BY avg_overall DESC
  `).all();

  const topics = db.prepare("SELECT category, topic, mastery, verified FROM technical_topics ORDER BY CASE mastery WHEN 'review' THEN 0 WHEN 'shaky' THEN 1 ELSE 2 END, category").all();

  const dueReviews = db.prepare(`
    SELECT pq.id, pq.ref_type, pq.ref_id, pq.due_at, a.question, a.rubric_kind
    FROM progress_queue pq LEFT JOIN attempts a ON pq.ref_type='attempt' AND pq.ref_id = a.id
    WHERE pq.due_at <= ? ORDER BY pq.due_at LIMIT 25
  `).all(now());

  res.json({ byStage, byBank, topics, dueReviews });
});
