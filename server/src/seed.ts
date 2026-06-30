import fs from "node:fs";
import path from "node:path";
import db from "./db.js";
import { DATA_DIR } from "./paths.js";
import type { Bank } from "./types.js";

function readFile(name: string): string {
  return fs.readFileSync(path.join(DATA_DIR, name), "utf8");
}

function seedBanks(): number {
  const raw = JSON.parse(readFile("banks.json")) as { banks: Bank[] };
  const stmt = db.prepare(`
    INSERT INTO banks (name, tier, hk_office, focus, mandarin, competition,
                       match_score, assessment, process, style_notes,
                       funnel_stage, verified, json)
    VALUES (@name, @tier, @hk_office, @focus, @mandarin, @competition,
            @match_score, @assessment, @process, @style_notes,
            @funnel_stage, @verified, @json)
    ON CONFLICT(name) DO UPDATE SET
      tier=@tier, hk_office=@hk_office, focus=@focus, mandarin=@mandarin,
      competition=@competition, match_score=@match_score, assessment=@assessment,
      process=@process, style_notes=@style_notes, funnel_stage=@funnel_stage,
      verified=@verified, json=@json
  `);
  const tx = db.transaction((banks: Bank[]) => {
    for (const b of banks) {
      stmt.run({
        name: b.name,
        tier: b.tier,
        hk_office: b.hk_office ? 1 : 0,
        focus: b.focus ?? "",
        mandarin: b.mandarin ?? "none",
        competition: b.competition ?? null,
        match_score: b.match ?? null,
        assessment: b.assessment ?? "",
        process: b.process ?? "",
        style_notes: b.style_notes ?? "",
        funnel_stage: b.funnel_stage ?? "not_started",
        verified: b.verified ? 1 : 0,
        json: JSON.stringify(b),
      });
    }
  });
  tx(raw.banks);
  return raw.banks.length;
}

function seedDoc(file: string, key: string) {
  // Personal files (profile.md, story_bank.md) are gitignored. On a fresh clone
  // they won't exist yet — fall back to the committed .example template.
  let path_ = path.join(DATA_DIR, file);
  if (!fs.existsSync(path_)) {
    const example = path.join(DATA_DIR, file.replace(/\.md$/, ".example.md"));
    if (fs.existsSync(example)) {
      console.warn(`[seed] ${file} not found — seeding from ${file.replace(/\.md$/, ".example.md")} (copy it to ${file} and fill in your data).`);
      path_ = example;
    }
  }
  const content = fs.readFileSync(path_, "utf8");
  const hasTodo = /\[TODO|\[CONFIRM|\[VERIFY/i.test(content) ? 1 : 0;
  db.prepare(`
    INSERT INTO docs (key, content, has_todo, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET content=excluded.content,
      has_todo=excluded.has_todo, updated_at=excluded.updated_at
  `).run(key, content, hasTodo);
}

// Parse `· mastery: X · verified: Y` trailing metadata from each topic bullet.
function seedTopics(): number {
  const md = readFile("technical_topics.md");
  db.prepare("DELETE FROM technical_topics").run();
  const insert = db.prepare(`
    INSERT INTO technical_topics (category, topic, subtopics, mastery, verified)
    VALUES (?, ?, ?, ?, ?)
  `);
  let category = "General";
  let count = 0;
  for (const line of md.split("\n")) {
    const cat = line.match(/^##\s+(.+)/);
    if (cat) {
      category = cat[1].trim();
      continue;
    }
    if (category.startsWith("[TODO")) continue; // skip the open "add others" bucket
    const bullet = line.match(/^-\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (!bullet) continue;
    const topic = bullet[1].trim();
    const rest = bullet[2];
    const mastery = (rest.match(/mastery:\s*(strong|shaky|review)/i)?.[1] ?? "review").toLowerCase();
    const verified = /verified:\s*true/i.test(rest) ? 1 : 0;
    const subtopics = rest.split("·")[0].replace(/^[—–-]\s*/, "").trim();
    insert.run(category, topic, subtopics, mastery, verified);
    count++;
  }
  return count;
}

// Parse real_questions.md entries of the documented shape.
function seedRealQuestions(): number {
  const md = readFile("real_questions.md");
  db.prepare("DELETE FROM real_questions").run();
  const insert = db.prepare(`
    INSERT INTO real_questions (bank, stage, question, source, date)
    VALUES (?, ?, ?, ?, ?)
  `);
  let count = 0;
  let inEntries = false;
  for (const line of md.split("\n")) {
    if (/^##\s+Entries/i.test(line)) { inEntries = true; continue; }
    if (!inEntries) continue; // skip the format-description lines above Entries
    if (line.trimStart().startsWith("<!--")) break; // stop at the example comment
    const m = line.match(
      /bank:\s*(.+?)\s*·\s*stage:\s*(.+?)\s*·\s*question:\s*"([^"]+)"\s*·\s*source:\s*(.+?)\s*·\s*date:\s*(\S+)/i,
    );
    if (!m) continue;
    insert.run(m[1].trim(), m[2].trim(), m[3].trim(), m[4].trim(), m[5].trim());
    count++;
  }
  return count;
}

function seedTechnicalBank(): number {
  const file = path.join(DATA_DIR, "technical_bank.json");
  if (!fs.existsSync(file)) return 0;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { questions: any[] };
  db.prepare("DELETE FROM technical_bank").run();
  const insert = db.prepare(`
    INSERT INTO technical_bank (id, source, number, question, answer_key, topic_tags, difficulty)
    VALUES (@id, @source, @number, @question, @answer_key, @topic_tags, @difficulty)
  `);
  const tx = db.transaction((items: any[]) => {
    for (const q of items) {
      insert.run({
        id: q.id, source: q.source, number: q.number ?? null,
        question: q.question, answer_key: q.answerKey ?? "",
        topic_tags: JSON.stringify(q.topicTags ?? []), difficulty: q.difficulty ?? "medium",
      });
    }
  });
  tx(raw.questions);
  return raw.questions.length;
}

function seedReferences(): number {
  const file = path.join(DATA_DIR, "references.json");
  if (!fs.existsSync(file)) return 0;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { references: any[] };
  db.prepare("DELETE FROM references_doc").run();
  const insert = db.prepare("INSERT INTO references_doc (id, topic, match_json, content) VALUES (@id, @topic, @match_json, @content)");
  const tx = db.transaction((items: any[]) => {
    for (const r of items) {
      insert.run({ id: r.id, topic: r.topic, match_json: JSON.stringify(r.match ?? []), content: r.content ?? "" });
    }
  });
  tx(raw.references);
  return raw.references.length;
}

export function seedAll() {
  const banks = seedBanks();
  seedDoc("profile.md", "profile");
  seedDoc("story_bank.md", "story_bank");
  seedDoc("hirevue_notes.md", "hirevue_notes");
  const topics = seedTopics();
  const rq = seedRealQuestions();
  const techBank = seedTechnicalBank();
  const references = seedReferences();
  return { banks, topics, realQuestions: rq, techBank, references };
}

// Run directly: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = seedAll();
  console.log(
    `Seeded: ${r.banks} banks, ${r.topics} technical topics, ${r.realQuestions} real questions, ${r.techBank} drill questions, ${r.references} reference primers.`,
  );
  console.log("Docs seeded: profile, story_bank, hirevue_notes.");
}
