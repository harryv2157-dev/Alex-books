"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireReader } from "@/lib/auth";
import { getBook, listSessions } from "@/lib/books";
import { query } from "@/lib/db";
import { askText } from "@/lib/claude";
import { canStartBuddyReads } from "@/lib/buddy";
import { randomBytes } from "crypto";
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

export async function logSession(bookId: number, page: number, note: string, minutes: number | null = null) {
  await ownedBookId(bookId);
  if (!Number.isFinite(page) || page < 0) throw new Error("Enter the page you got to");
  const mins = minutes && minutes > 0 ? Math.min(24 * 60, Math.round(minutes)) : null;
  await query(`INSERT INTO reading_sessions (book_id, page, note, minutes) VALUES ($1, $2, $3, $4)`, [
    bookId,
    Math.round(page),
    note.trim() || null,
    mins,
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

  const res = await askText({
    system:
      "You help a reader look back on a book they've read. Using only their own notes and review, write a warm, " +
      "personal synthesis of what they thought and felt as the book went on: how their views shifted, the moments " +
      "that stood out, and where they landed. Write in second person (\"you\"), in 2-4 short paragraphs of plain " +
      "prose with no headings. Don't invent plot details or opinions they didn't express, and don't spoil anything " +
      "beyond what their notes already mention.",
    prompt,
  });
  if (!res.ok) return res;
  await query(`UPDATE books SET synthesis = $2 WHERE id = $1`, [bookId, res.value]);
  revalidatePath(`/books/${bookId}`);
  return { ok: true };
}

export async function sendLoveNote(message: string, showInstall: boolean) {
  const reader = await requireReader();
  if (!isNoteEditor(reader)) throw new Error("Not allowed");
  const text = message.trim();
  if (!text) throw new Error("The note can't be empty");
  await query(`INSERT INTO love_notes (message, show_install) VALUES ($1, $2)`, [text, showInstall]);
  revalidatePath("/note");
  revalidatePath("/");
}

// Change the note she currently sees. She'll get it again as unread.
export async function updateCurrentLoveNote(message: string, showInstall: boolean) {
  const reader = await requireReader();
  if (!isNoteEditor(reader)) throw new Error("Not allowed");
  const text = message.trim();
  if (!text) throw new Error("The note can't be empty");
  const updated = await query(
    `UPDATE love_notes SET message = $1, show_install = $2, seen_at = NULL
     WHERE id = (SELECT id FROM love_notes ORDER BY created_at DESC, id DESC LIMIT 1) RETURNING id`,
    [text, showInstall],
  );
  if (updated.length === 0) {
    await query(`INSERT INTO love_notes (message, show_install) VALUES ($1, $2)`, [text, showInstall]);
  }
  revalidatePath("/note");
  revalidatePath("/");
}

export async function markLoveNoteSeen() {
  const reader = await requireReader();
  if (!isNoteRecipient(reader)) return;
  const updated = await query(
    `UPDATE love_notes SET seen_at = now()
     WHERE id = (SELECT id FROM love_notes ORDER BY created_at DESC, id DESC LIMIT 1) AND seen_at IS NULL
     RETURNING id`,
  );
  // She read the built-in first note before any was saved: record it so it doesn't pop up again.
  if (updated.length === 0) {
    await query(
      `INSERT INTO love_notes (message, show_install, seen_at)
       SELECT $1, true, now() WHERE NOT EXISTS (SELECT 1 FROM love_notes)`,
      [DEFAULT_LOVE_NOTE],
    );
  }
  revalidatePath("/note");
}

// ---------- Buddy reads ----------

export async function startBuddyRead(bookId: number): Promise<string> {
  const reader = await requireReader();
  if (!canStartBuddyReads(reader)) throw new Error("Buddy reads aren't switched on for your account");
  const book = await getBook(reader.id, bookId);
  if (!book) throw new Error("Book not found");
  const [existing] = await query<{ code: string }>(
    `SELECT r.code FROM buddy_members m JOIN buddy_reads r ON r.id = m.buddy_id WHERE m.user_id = $1 AND m.book_id = $2`,
    [reader.id, bookId],
  );
  if (existing) return existing.code;
  const [src] = await query<{ cover_url: string | null }>(`SELECT cover_url FROM books WHERE id = $1`, [bookId]);
  const code = randomBytes(6).toString("base64url");
  const [row] = await query<{ id: number }>(
    `INSERT INTO buddy_reads (code, title, author, total_pages, cover_url, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [code, book.title, book.author, book.total_pages, src?.cover_url ?? null, reader.id],
  );
  await query(`INSERT INTO buddy_members (buddy_id, user_id, book_id) VALUES ($1, $2, $3)`, [row.id, reader.id, bookId]);
  revalidatePath(`/books/${bookId}`);
  return code;
}

export async function joinBuddyRead(code: string) {
  const reader = await requireReader();
  const [read] = await query<{ id: number; title: string; author: string | null; total_pages: number | null; cover_url: string | null }>(
    `SELECT id, title, author, total_pages, cover_url FROM buddy_reads WHERE code = $1`,
    [code],
  );
  if (!read) throw new Error("That invite link isn't valid any more");
  const [member] = await query<{ book_id: number }>(`SELECT book_id FROM buddy_members WHERE buddy_id = $1 AND user_id = $2`, [
    read.id,
    reader.id,
  ]);
  let bookId = member?.book_id;
  if (!bookId) {
    // Use the copy already on their shelf, or put the book there.
    const [own] = await query<{ id: number }>(
      `SELECT id FROM books WHERE user_id = $1 AND lower(title) = lower($2) ORDER BY created_at DESC LIMIT 1`,
      [reader.id, read.title],
    );
    bookId =
      own?.id ??
      (
        await query<{ id: number }>(
          `INSERT INTO books (user_id, title, author, total_pages, cover_url) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [reader.id, read.title, read.author, read.total_pages, read.cover_url],
        )
      )[0].id;
    await query(`INSERT INTO buddy_members (buddy_id, user_id, book_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
      read.id,
      reader.id,
      bookId,
    ]);
  }
  revalidatePath("/");
  redirect(`/books/${bookId}`);
}

export async function leaveBuddyRead(bookId: number) {
  const reader = await requireReader();
  await query(`DELETE FROM buddy_members WHERE user_id = $1 AND book_id = $2`, [reader.id, bookId]);
  revalidatePath(`/books/${bookId}`);
}

export async function markAnnouncementRead(key: string) {
  const reader = await requireReader();
  await query(`INSERT INTO announcement_reads (user_id, key) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [reader.id, key]);
  revalidatePath("/note");
}
