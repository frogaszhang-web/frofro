import "dotenv/config";
import { seedAll } from "./seed.js";
import { chat, aiConfig } from "./ai.js";

// Minimal smoke test (§10): confirms the data layer seeds and the AI wiring
// returns one graded-style response. Phase 3 expands this into a full graded
// attempt against the real rubric prompts.
async function main() {
  console.log("1) Seeding data...");
  const r = seedAll();
  console.log(`   ok: ${r.banks} banks, ${r.topics} topics, ${r.realQuestions} real questions`);

  const cfg = aiConfig();
  console.log(`2) AI config: provider=${cfg.provider} grading=${cfg.grading_model} key=${cfg.key_present ? "set" : "MISSING"}`);
  if (!cfg.key_present) {
    console.log("   No API key set — skipping live AI call. Add ANTHROPIC_API_KEY to .env to test grading.");
    return;
  }

  console.log("3) Live AI round-trip (grading tier)...");
  const out = await chat({
    tier: "grading",
    system: "You are a terse IB interview grader. Reply in one sentence.",
    user: "Grade this answer to 'Why investment banking?': 'I like finance and want to learn a lot.'",
  });
  console.log("   model said:", out.trim());
  console.log("Smoke test complete.");
}

main().catch((e) => {
  console.error("Smoke test FAILED:", e);
  process.exit(1);
});
