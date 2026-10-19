import { query } from "@/lib/db";
import { emailsFrom } from "@/lib/loveNote";

export const dynamic = "force-dynamic";

// Reports which settings are present (never their values) and whether the database answers.
export async function GET() {
  const env = Object.fromEntries(
    ["DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ANTHROPIC_API_KEY"].map(
      (k) => [k, Boolean(process.env[k])],
    ),
  );
  // How many valid emails each love-note setting holds (never the emails themselves).
  const loveNote = {
    LOVE_NOTE_EMAIL: emailsFrom("LOVE_NOTE_EMAIL").length,
    LOVE_NOTE_EDITOR_EMAIL: emailsFrom("LOVE_NOTE_EDITOR_EMAIL").length,
  };
  let database = "ok";
  try {
    await query("SELECT 1");
  } catch (err) {
    console.error("Health check: database error", err);
    database = (err as Error).message.replace(/postgres(ql)?:\/\/[^\s]+/g, "[db url]");
  }
  return Response.json({ env, loveNote, database }, { status: database === "ok" ? 200 : 500 });
}
