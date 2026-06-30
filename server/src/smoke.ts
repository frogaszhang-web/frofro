import "dotenv/config";
import { seedAll } from "./seed.js";
import { aiConfig } from "./ai.js";
import { generateQuestions, gradeAnswer, judgeProbe, sampleTechnicalQuestions } from "./engine.js";

// Smoke test (§10): confirms the data layer seeds and the AI wiring runs one
// full graded attempt (generate -> grade -> defensibility probe).
async function main() {
  console.log("1) Seeding data...");
  const r = seedAll();
  console.log(`   ok: ${r.banks} banks, ${r.topics} topics, ${r.realQuestions} real questions, ${r.techBank} answer-keyed drill questions`);

  const cfg = aiConfig();
  console.log(`2) AI: provider=${cfg.provider} grading=${cfg.grading_model} generation=${cfg.generation_model} key=${cfg.key_present ? "set" : "MISSING"}`);
  if (!cfg.key_present) {
    console.log("   No key — skipping live AI. Add ANTHROPIC_API_KEY (or set AI_PROVIDER=local) and re-run.");
    return;
  }

  console.log("3) Generating a HireVue question for JPMorgan...");
  const qs = await generateQuestions({ stage: "hirevue", bankName: "JPMorgan", count: 1 });
  const q = qs[0];
  console.log(`   [${q.kind}] ${q.prompt}`);

  console.log("4) Grading a sample answer...");
  const grade = await gradeAnswer({
    question: q.prompt, kind: q.kind, bankName: "JPMorgan",
    answer: "I want to do banking in Hong Kong because I'm bilingual and Hong Kong is where Chinese companies meet global capital, which is exactly the cross-border M&A I care about.",
  });
  console.log(`   overall ${grade.overall}/5; dims: ${grade.dimensions.map((d) => `${d.name}=${d.score}`).join(", ")}`);
  console.log(`   followup: ${grade.followup}`);
  if (grade.flags.length) console.log(`   flags: ${grade.flags.join("; ")}`);

  console.log("5) Defensibility probe...");
  const probe = await judgeProbe({
    topic: q.topicTags[0] ?? q.kind, question: q.prompt, followup: grade.followup,
    answer: "Because southbound flows and index inclusion are structurally driving liquidity to HK-listed China names.",
  });
  console.log(`   survived=${probe.survived}: ${probe.verdict}`);

  console.log("6) Answer-keyed technical grading (drill bank)...");
  const tq = sampleTechnicalQuestions(1)[0];
  if (tq) {
    const tg = await gradeAnswer({ question: tq.prompt, kind: "technical", answer: "Revenue goes up and net income goes up." });
    console.log(`   Q: ${tq.prompt.slice(0, 70)}…`);
    console.log(`   graded vs answer key -> overall ${tg.overall}/5; correctness=${tg.dimensions.find((d) => d.name === "correctness")?.score}`);
  }

  console.log("Smoke test complete — full pipeline works.");
}

main().catch((e) => { console.error("Smoke test FAILED:", e); process.exit(1); });
