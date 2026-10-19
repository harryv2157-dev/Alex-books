"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireReader } from "@/lib/auth";
import { getBook, listSessions } from "@/lib/books";
import { query } from "@/lib/db";
import { DEFAULT_LOVE_NOTE, isNoteEditor, isNoteRecipient } from "@/lib/loveNote";

function parseDataUrl(dataUrl: string | null | undefined): { type: string; data: Buffer } | null {
  if (!dataUrl) return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { type: m[1], data: Buffer.from(m[2], "base64") };
}

async function ownedBookId(bookId: number): Promise<{ userId: number; bookId: number }> {
  const reader = await requireReader();
  const book = await getBook(reader.id, bookId);
  if (!book) throw new Error("Book not found");
  return { userId: reader.id, bookId };
}

export async function addBook(input: {
  title: string;
  author?: string;
  totalPages?: number | null;
  coverUrl?: string | null;
  photo?: string | null;
}) {
  const reader = await requireReader();
  const title = input.title.trim();
  if (!title) throw new Error("A book needs a title");
  const photo = parseDataUrl(input.photo);
  const coverUrl = input.coverUrl?.startsWith("https://covers.openlibrary.org/") ? input.coverUrl : null;
  const [row] = await query<{ id: number }>(
    `INSERT INTO books (user_id, title, author, total_pages, cover_url, cover_data, cover_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      reader.id,
      title,
      input.author?.trim() || null,
      input.totalPages && input.totalPages > 0 ? Math.round(input.totalPages) : null,
      coverUrl,
      photo?.data ?? null,
      photo?.type ?? null,
    ],
  );
  revalidatePath("/");
  redirect(`/books/${row.id}`);
}

export async function logSession(bookId: number, page: number, note: string) {
  await ownedBookId(bookId);
  if (!Number.isFinite(page) || page < 0) throw new Error("Enter the page you got to");
  await query(`INSERT INTO reading_sessions (book_id, page, note) VALUES ($1, $2, $3)`, [
    bookId,
    Math.round(page),
    note.trim() || null,
  ]);
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/");
}

export async function deleteSession(bookId: number, sessionId: number) {
  await ownedBookId(bookId);
  await query(`DELETE FROM reading_sessions WHERE id = $1 AND book_id = $2`, [sessionId, bookId]);
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/");
}

export async function updateBookDetails(bookId: number, input: { title: string; author: string; totalPages: number | null }) {
  await ownedBookId(bookId);
  await query(`UPDATE books SET title = $2, author = $3, total_pages = $4 WHERE id = $1`, [
    bookId,
    input.title.trim() || "Untitled",
    input.author.trim() || null,
    input.totalPages && input.totalPages > 0 ? Math.round(input.totalPages) : null,
  ]);
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/");
}

export async function setCoverPhoto(bookId: number, photo: string) {
  await ownedBookId(bookId);
  const parsed = parseDataUrl(photo);
  if (!parsed) throw new Error("That photo couldn't be read");
  await query(`UPDATE books SET cover_data = $2, cover_type = $3, spine_color = NULL WHERE id = $1`, [
    bookId,
    parsed.data,
    parsed.type,
  ]);
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/");
}

export async function setBackCoverPhoto(bookId: number, photo: string) {
  await ownedBookId(bookId);
  const parsed = parseDataUrl(photo);
  if (!parsed) throw new Error("That photo couldn't be read");
  await query(`UPDATE books SET back_data = $2, back_type = $3 WHERE id = $1`, [bookId, parsed.data, parsed.type]);
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/");
}

export async function saveSpineColor(bookId: number, color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  await ownedBookId(bookId);
  await query(`UPDATE books SET spine_color = $2 WHERE id = $1`, [bookId, color]);
}

export async function finishBook(bookId: number, rating: number | null, review: string) {
  await ownedBookId(bookId);
  const stars = rating && rating >= 1 && rating <= 5 ? Math.round(rating) : null;
  await query(
    `UPDATE books SET status = 'finished', finished_at = COALESCE(finished_at, now()), rating = $2, review = $3 WHERE id = $1`,
    [bookId, stars, review.trim() || null],
  );
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/");
}

export async function reopenBook(bookId: number) {
  await ownedBookId(bookId);
  await query(`UPDATE books SET status = 'reading', finished_at = NULL WHERE id = $1`, [bookId]);
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/");
}

export async function deleteBook(bookId: number) {
  await ownedBookId(bookId);
  await query(`DELETE FROM books WHERE id = $1`, [bookId]);
  revalidatePath("/");
  redirect("/");
}

export async function synthesizeThoughts(bookId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const reader = await requireReader();
  const book = await getBook(reader.id, bookId);
  if (!book) return { ok: false, error: "Book not found" };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "The AI summary isn't switched on yet (no ANTHROPIC_API_KEY on the server)." };
  }
  const sessions = (await listSessions(bookId)).reverse();
  const notes = sessions.filter((s) => s.note);
  if (notes.length === 0 && !book.review) {
    return { ok: false, error: "There are no notes or review to summarise yet." };
  }

  const journal = notes
    .map((s) => `- ${new Date(s.created_at).toDateString()}, around page ${s.page}: ${s.note}`)
    .join("\n");
  const prompt = [
    `Book: "${book.title}"${book.author ? ` by ${book.author}` : ""}`,
    book.total_pages ? `Length: ${book.total_pages} pages` : "",
    book.rating ? `Their rating: ${book.rating}/5` : "",
    book.review ? `Their final review:\n${book.review}` : "",
    journal ? `Notes they jotted while reading, in order:\n${journal}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "You help a reader look back on a book they've read. Using only their own notes and review, write a warm, " +
        "personal synthesis of what they thought and felt as the book went on: how their views shifted, the moments " +
        "that stood out, and where they landed. Write in second person (\"you\"), in 2-4 short paragraphs of plain " +
        "prose with no headings. Don't invent plot details or opinions they didn't express, and don't spoil anything " +
        "beyond what their notes already mention.",
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      return { ok: false, error: "Claude couldn't write a summary for this one." };
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!text) return { ok: false, error: "The summary came back empty — try again." };
    await query(`UPDATE books SET synthesis = $2 WHERE id = $1`, [bookId, text]);
    revalidatePath(`/books/${bookId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "The Claude API key on the server was rejected." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Claude is busy right now — try again in a minute." };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: `Claude returned an error (${err.status ?? "network"}).` };
    }
    throw err;
  }
}

export async function saveLoveNote(message: string) {
  const reader = await requireReader();
  if (!isNoteEditor(reader)) throw new Error("Not allowed");
  const text = message.trim();
  if (!text) throw new Error("The note can't be empty");
  await query(
    `INSERT INTO love_note (id, message, updated_at, seen_at) VALUES (1, $1, now(), NULL)
     ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, updated_at = now(), seen_at = NULL`,
    [text],
  );
  revalidatePath("/note");
  revalidatePath("/");
}

export async function markLoveNoteSeen() {
  const reader = await requireReader();
  if (!isNoteRecipient(reader)) return;
  // Create the row from the default message the first time she reads it, so "seen" sticks.
  await query(
    `INSERT INTO love_note (id, message, seen_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET seen_at = now()`,
    [DEFAULT_LOVE_NOTE],
  );
}
