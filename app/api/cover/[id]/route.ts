import { currentReader } from "@/lib/auth";
import { query } from "@/lib/db";

// Serves a book's cover from our own origin, so the shelf can read its colours.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const reader = await currentReader();
  if (!reader) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  if (new URL(req.url).searchParams.get("side") === "back") {
    const [back] = await query<{ back_data: Buffer | null; back_type: string | null }>(
      `SELECT back_data, back_type FROM books WHERE id = $1 AND user_id = $2`,
      [Number(id), reader.id],
    );
    if (!back?.back_data) return new Response("No back cover", { status: 404 });
    return new Response(new Uint8Array(back.back_data), {
      headers: { "Cache-Control": "private, max-age=3600", "Content-Type": back.back_type ?? "image/jpeg" },
    });
  }
  const [row] = await query<{ cover_data: Buffer | null; cover_type: string | null; cover_url: string | null }>(
    `SELECT cover_data, cover_type, cover_url FROM books WHERE id = $1 AND user_id = $2`,
    [Number(id), reader.id],
  );
  if (!row) return new Response("Not found", { status: 404 });

  const headers = { "Cache-Control": "private, max-age=3600" };
  if (row.cover_data) {
    return new Response(new Uint8Array(row.cover_data), {
      headers: { ...headers, "Content-Type": row.cover_type ?? "image/jpeg" },
    });
  }
  if (row.cover_url) {
    const upstream = await fetch(row.cover_url);
    if (upstream.ok) {
      return new Response(upstream.body, {
        headers: { ...headers, "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg" },
      });
    }
  }
  return new Response("No cover", { status: 404 });
}
