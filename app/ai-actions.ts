"use server";

import { revalidatePath } from "next/cache";
import { requireReader } from "@/lib/auth";
import { getBook, listSessions } from "@/lib/books";
import { askJson, askText, type ClaudeResult } from "@/lib/claude";
import { query } from "@/lib/db";
import { yearStats } from "@/lib/stats";

const byLine = (b: { title: string; author: string | null }) => `"${b.title}"${b.author ? ` by ${b.author}` : ""}`;

// ---------- Tidy a dictated note ----------

export async function tidyNote(bookId: number, spoken: string): Promise<ClaudeResult> {
  const reader = await requireReader();
  const book = await getBook(reader.id, bookId);
  const text = spoken.trim();
  if (!text) return { ok: true, value: "" };
  return askText({
    effort: "low",
    maxTokens: 4000,
    system:
      "You clean up a reader's spoken note that came from phone speech-to-text. Add punctuation, capital letters and " +
      "paragraph breaks where natural, and fix words the speech recognition obviously misheard (character names, " +
      "places and terms from the book are common). Keep their exact words, slang, tone and meaning: never add ideas, " +
      "remove content, summarise or make it more formal. Reply with only the cleaned note.",
    prompt: `${book ? `The book is ${byLine(book)}.\n\n` : ""}Spoken note:\n${text}`,
  });
}

// ---------- "Where was I?" recap ----------

export async function recapBook(bookId: number, refresh = false): Promise<ClaudeResult> {
  const reader = await requireReader();
  const book = await getBook(reader.id, bookId);
  if (!book) return { ok: false, error: "Book not found" };
  const sessions = (await listSessions(bookId)).reverse();
  const notes = sessions.filter((s) => s.note);
  if (notes.length === 0) return { ok: false, error: "There are no notes to recap yet. Add a thought next time you log a session." };
  const basis = `${sessions.length}:${sessions[sessions.length - 1]?.id ?? 0}`;
  if (!refresh) {
    const [cached] = await query<{ recap: string | null; recap_basis: string | null }>(
      `SELECT recap, recap_basis FROM books WHERE id = $1`,
      [bookId],
    );
    if (cached?.recap && cached.recap_basis === basis) return { ok: true, value: cached.recap };
  }
  const last = sessions[sessions.length - 1];
  const res = await askText({
    effort: "low",
    maxTokens: 4000,
    system:
      "A reader is picking a book back up and wants a quick reminder of where they were. Using ONLY their own " +
      "notes below, write 3-5 short sentences in second person (\"you\") recapping what had happened and how they " +
      "were feeling about it, ending with where they stopped. Never add plot details, characters or events their " +
      "notes don't mention, so nothing can be spoiled. Plain prose, no headings or lists.",
    prompt: [
      `Book: ${byLine(book)}`,
      `They last read on ${new Date(last.created_at).toDateString()} and stopped at page ${last.page}${book.total_pages ? ` of ${book.total_pages}` : ""}.`,
      `Their notes, oldest first:\n${notes.map((s) => `- around page ${s.page}: ${s.note}`).join("\n")}`,
    ].join("\n\n"),
  });
  if (!res.ok) return res;
  await query(`UPDATE books SET recap = $2, recap_basis = $3 WHERE id = $1`, [bookId, res.value, basis]);
  return res;
}

// ---------- What to read next ----------

export type Recommendation = { title: string; author: string; why: string; coverUrl: string | null; pages: number | null };

const REC_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          why: { type: "string" },
        },
        required: ["title", "author", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

async function openLibraryLookup(title: string, author: string) {
  try {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("title", title);
    url.searchParams.set("author", author);
    url.searchParams.set("limit", "1");
    url.searchParams.set("fields", "number_of_pages_median,cover_i");
    const res = await fetch(url, { headers: { "User-Agent": "AlexBooks/0.1 (personal reading tracker)" } });
    if (!res.ok) return { coverUrl: null, pages: null };
    const doc = ((await res.json()) as { docs: { cover_i?: number; number_of_pages_median?: number }[] }).docs[0];
    return {
      coverUrl: doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
      pages: doc?.number_of_pages_median ?? null,
    };
  } catch {
    return { coverUrl: null, pages: null };
  }
}

export async function getRecommendations(refresh = false): Promise<ClaudeResult<{ items: Recommendation[]; createdAt: string }>> {
  const reader = await requireReader();
  const books = await query<{
    title: string;
    author: string | null;
    status: string;
    rating: number | null;
    review: string | null;
    synthesis: string | null;
    notes: string | null;
  }>(
    `SELECT b.title, b.author, b.status, b.rating, b.review, b.synthesis,
            (SELECT string_agg(s.note, ' / ' ORDER BY s.created_at) FROM reading_sessions s WHERE s.book_id = b.id AND s.note IS NOT NULL) AS notes
     FROM books b WHERE b.user_id = $1 ORDER BY b.created_at`,
    [reader.id],
  );
  if (books.length === 0) return { ok: false, error: "Add a book or two first, then I can suggest what to read next." };
  const basis = books.map((b) => `${b.title}|${b.status}|${b.rating ?? ""}`).join(";");
  if (!refresh) {
    const [cached] = await query<{ items: Recommendation[]; basis: string; created_at: Date }>(
      `SELECT items, basis, created_at FROM recommendations WHERE user_id = $1`,
      [reader.id],
    );
    if (cached && cached.basis === basis) return { ok: true, value: { items: cached.items, createdAt: cached.created_at.toISOString() } };
  }

  const describe = (b: (typeof books)[number]) =>
    [
      `- ${byLine(b)}: ${b.status === "finished" ? `finished${b.rating ? `, rated ${b.rating}/5` : ""}` : "currently reading"}`,
      b.review ? `  Review: ${b.review.slice(0, 600)}` : "",
      b.notes ? `  Notes while reading: ${b.notes.slice(0, 600)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  const res = await askJson<{ items: { title: string; author: string; why: string }[] }>(
    {
      effort: "medium",
      system:
        "You are a well-read friend recommending books. Suggest exactly 5 real, published books this reader would " +
        "love next, based on what they rated highly, what they wrote they loved and what annoyed them. Never suggest " +
        "a book they already have. Mix it up: no more than one book per author. For each, write one or two warm " +
        "sentences in second person explaining why it suits them, pointing at specific things from their reviews or " +
        "notes. No spoilers.",
      prompt: `Their books:\n${books.map(describe).join("\n")}`,
    },
    REC_SCHEMA,
  );
  if (!res.ok) return res;
  const items: Recommendation[] = await Promise.all(
    res.value.items.slice(0, 5).map(async (r) => ({ ...r, ...(await openLibraryLookup(r.title, r.author)) })),
  );
  const [row] = await query<{ created_at: Date }>(
    `INSERT INTO recommendations (user_id, items, basis) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items, basis = EXCLUDED.basis, created_at = now()
     RETURNING created_at`,
    [reader.id, JSON.stringify(items), basis],
  );
  return { ok: true, value: { items, createdAt: row.created_at.toISOString() } };
}

// ---------- Year in review ----------

export type YearStory = { story: string; themes: string[]; highlights: { quote: string; book: string }[] };

const YEAR_SCHEMA = {
  type: "object",
  properties: {
    story: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
    highlights: {
      type: "array",
      items: {
        type: "object",
        properties: { quote: { type: "string" }, book: { type: "string" } },
        required: ["quote", "book"],
        additionalProperties: false,
      },
    },
  },
  required: ["story", "themes", "highlights"],
  additionalProperties: false,
};

export async function writeYearReview(year: number): Promise<ClaudeResult<YearStory>> {
  const reader = await requireReader();
  const stats = await yearStats(reader.id, year);
  const books = await query<{ id: number; title: string; author: string | null; status: string; rating: number | null; review: string | null }>(
    `SELECT DISTINCT b.id, b.title, b.author, b.status, b.rating, b.review
     FROM books b LEFT JOIN reading_sessions s ON s.book_id = b.id
     WHERE b.user_id = $1 AND (EXTRACT(YEAR FROM s.created_at) = $2 OR EXTRACT(YEAR FROM b.finished_at) = $2)`,
    [reader.id, year],
  );
  if (books.length === 0) return { ok: false, error: `Nothing logged in ${year} yet.` };
  const notes = await query<{ title: string; page: number; note: string }>(
    `SELECT b.title, s.page, s.note FROM reading_sessions s JOIN books b ON b.id = s.book_id
     WHERE b.user_id = $1 AND EXTRACT(YEAR FROM s.created_at) = $2 AND s.note IS NOT NULL ORDER BY s.created_at`,
    [reader.id, year],
  );
  const res = await askJson<YearStory>(
    {
      effort: "medium",
      system:
        "Write a reader's personal 'year in books', like a warm end-of-year Wrapped. Using only the books, ratings, " +
        "reviews and notes given: `story` is 2-3 short paragraphs in second person about their reading year (what " +
        "they gravitated to, how their tastes showed, standout moments), celebratory but honest, no headings. " +
        "`themes` is 3-4 short phrases (2-4 words each) naming threads across their reading. `highlights` is up to 3 " +
        "of their own notes or review lines copied WORD FOR WORD (trim to one or two sentences if long), each with " +
        "the book title. Don't invent opinions or plot details.",
      prompt: [
        `Year: ${year}. Books finished: ${stats.booksFinished}. Pages read: ${stats.pages}. Hours read: ${Math.round(stats.minutes / 60)}.`,
        `Books:\n${books
          .map((b) => `- ${byLine(b)}: ${b.status === "finished" ? `finished${b.rating ? `, ${b.rating}/5` : ""}` : "still reading"}${b.review ? `. Review: ${b.review.slice(0, 500)}` : ""}`)
          .join("\n")}`,
        notes.length ? `Notes:\n${notes.map((n) => `- ${n.title}, p.${n.page}: ${n.note}`).join("\n").slice(0, 12000)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    YEAR_SCHEMA,
  );
  if (!res.ok) return res;
  const value: YearStory = { ...res.value, themes: res.value.themes.slice(0, 4), highlights: res.value.highlights.slice(0, 3) };
  await query(
    `INSERT INTO year_reviews (user_id, year, story, highlights, basis) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, year) DO UPDATE SET story = EXCLUDED.story, highlights = EXCLUDED.highlights, basis = EXCLUDED.basis, created_at = now()`,
    [reader.id, year, value.story, JSON.stringify({ themes: value.themes, highlights: value.highlights }), `${stats.sessions}`],
  );
  revalidatePath("/year");
  return { ok: true, value };
}
