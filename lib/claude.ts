import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type ClaudeResult<T = string> = { ok: true; value: T } | { ok: false; error: string };

type Ask = {
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
};

let client: Anthropic | null = null;

async function call({ system, prompt, effort = "medium", maxTokens = 16000 }: Ask, schema?: Record<string, unknown>) {
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    output_config: schema ? { effort, format: { type: "json_schema", schema } } : { effort },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") return null;
  return response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

function explain(err: unknown): ClaudeResult<never> {
  if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "The Claude API key on the server was rejected." };
  if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "Claude is busy right now. Try again in a minute." };
  if (err instanceof Anthropic.APIError) return { ok: false, error: `Claude returned an error (${err.status ?? "network"}).` };
  throw err;
}

const NO_KEY: ClaudeResult<never> = { ok: false, error: "Claude isn't switched on yet (no ANTHROPIC_API_KEY on the server)." };

export async function askText(ask: Ask): Promise<ClaudeResult> {
  if (!process.env.ANTHROPIC_API_KEY) return NO_KEY;
  try {
    const text = await call(ask);
    if (text === null) return { ok: false, error: "Claude couldn't help with this one." };
    if (!text) return { ok: false, error: "Claude's answer came back empty. Try again." };
    return { ok: true, value: text };
  } catch (err) {
    return explain(err);
  }
}

// Asks for JSON matching `schema` (structured outputs guarantee the shape).
export async function askJson<T>(ask: Ask, schema: Record<string, unknown>): Promise<ClaudeResult<T>> {
  if (!process.env.ANTHROPIC_API_KEY) return NO_KEY;
  try {
    const text = await call(ask, schema);
    if (text === null) return { ok: false, error: "Claude couldn't help with this one." };
    return { ok: true, value: JSON.parse(text) as T };
  } catch (err) {
    if (err instanceof SyntaxError) return { ok: false, error: "Claude's answer was cut short. Try again." };
    return explain(err);
  }
}
