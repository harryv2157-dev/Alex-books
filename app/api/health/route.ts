import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Reports which settings are present (never their values) and whether the database answers.
export async function GET() {
  const env = Object.fromEntries(
    ["DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ANTHROPIC_API_KEY"].map(
      (k) => [k, Boolean(process.env[k])],
    ),
  );
  let database = "ok";
  try {
    await query("SELECT 1");
  } catch (err) {
    console.error("Health check: database error", err);
    database = (err as Error).message.replace(/postgres(ql)?:\/\/[^\s]+/g, "[db url]");
  }
  return Response.json({ env, database }, { status: database === "ok" ? 200 : 500 });
}
