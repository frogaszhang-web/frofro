import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Model-agnostic AI layer. Everything that calls a model goes through chat().
// Switch providers with AI_PROVIDER in .env:
//   anthropic -> Anthropic Developer API (pay-as-you-go; NOT your Max plan)
//   local     -> any OpenAI-compatible endpoint (e.g. Ollama) for $0 runtime
// ---------------------------------------------------------------------------

export type Tier = "grading" | "generation";

const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

function modelFor(tier: Tier): string {
  if (PROVIDER === "local") {
    return tier === "grading"
      ? process.env.LOCAL_GRADING_MODEL ?? "llama3.1:8b"
      : process.env.LOCAL_GENERATION_MODEL ?? "llama3.1:8b";
  }
  return tier === "grading"
    ? process.env.ANTHROPIC_GRADING_MODEL ?? "claude-sonnet-4-6"
    : process.env.ANTHROPIC_GENERATION_MODEL ?? "claude-haiku-4-5";
}

export interface ChatArgs {
  system: string;
  user: string;
  tier: Tier;
  maxTokens?: number;
}

let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export async function chat(args: ChatArgs): Promise<string> {
  const model = modelFor(args.tier);
  const maxTokens = args.maxTokens ?? (args.tier === "grading" ? 2000 : 1500);

  if (PROVIDER === "local") {
    const base = process.env.LOCAL_BASE_URL ?? "http://localhost:11434/v1";
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LOCAL_API_KEY ?? "local"}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Local provider error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  // Anthropic
  const msg = await anthropic().messages.create({
    model,
    max_tokens: maxTokens,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export function aiConfig() {
  return {
    provider: PROVIDER,
    grading_model: modelFor("grading"),
    generation_model: modelFor("generation"),
    key_present:
      PROVIDER === "local" ? true : Boolean(process.env.ANTHROPIC_API_KEY),
  };
}
