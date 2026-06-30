import Database from "better-sqlite3";
import { DB_PATH } from "./paths.js";

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema covers the §9 entities. Banks/profile/topics/real_questions are
// seeded from the /data files; sessions/attempts/progress are app-generated.
db.exec(`
CREATE TABLE IF NOT EXISTS banks (
  name          TEXT PRIMARY KEY,
  tier          TEXT NOT NULL,
  hk_office     INTEGER NOT NULL DEFAULT 1,
  focus         TEXT,
  mandarin      TEXT,
  competition   INTEGER,
  match_score   INTEGER,
  assessment    TEXT,
  process       TEXT,
  style_notes   TEXT,
  funnel_stage  TEXT NOT NULL DEFAULT 'not_started',
  verified      INTEGER NOT NULL DEFAULT 0,
  json          TEXT NOT NULL            -- full bank object (recent_deals, warm_contacts, ...)
);

-- Raw editable docs (profile.md, story_bank.md, hirevue_notes.md) kept whole so
-- the LLM can use them as grounding context. Key = filename without extension.
CREATE TABLE IF NOT EXISTS docs (
  key       TEXT PRIMARY KEY,
  content   TEXT NOT NULL,
  has_todo  INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS technical_topics (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  category   TEXT NOT NULL,
  topic      TEXT NOT NULL,
  subtopics  TEXT,
  mastery    TEXT NOT NULL DEFAULT 'review',
  verified   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS real_questions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  bank      TEXT NOT NULL,
  stage     TEXT NOT NULL,
  question  TEXT NOT NULL,
  source    TEXT,
  date      TEXT
);

-- Answer-keyed technical drill bank (from the user's accounting prep PDFs).
-- Served as technical questions AND used as grading ground truth.
CREATE TABLE IF NOT EXISTS technical_bank (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL,
  number      INTEGER,
  question    TEXT NOT NULL,
  answer_key  TEXT NOT NULL,
  topic_tags  TEXT,
  difficulty  TEXT
);

-- Versioned story bank (managed in Phase 3).
CREATE TABLE IF NOT EXISTS stories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL,           -- behavioral | fit | pitch | resume_claim
  title        TEXT NOT NULL,
  body         TEXT,
  version_date TEXT
);

-- Mock sessions and graded attempts (Phase 3).
CREATE TABLE IF NOT EXISTS sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  stage         TEXT NOT NULL,
  bank          TEXT,
  created_at    TEXT NOT NULL,
  summary_score REAL
);

CREATE TABLE IF NOT EXISTS attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  answer       TEXT,
  rubric_kind  TEXT,                    -- technical | behavioral | fit | pitch
  scores_json  TEXT,                    -- per-dimension 1-5 + justifications
  followup     TEXT,                    -- the exact next probe
  model_answer TEXT,
  topic_tags   TEXT,
  created_at   TEXT NOT NULL
);

-- Spaced-repetition / weak-spot queue (Phase 3).
CREATE TABLE IF NOT EXISTS progress_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_type    TEXT NOT NULL,           -- topic | attempt
  ref_id      INTEGER NOT NULL,
  due_at      TEXT NOT NULL,
  ease        REAL NOT NULL DEFAULT 2.0,
  last_score  REAL
);
`);

export default db;
