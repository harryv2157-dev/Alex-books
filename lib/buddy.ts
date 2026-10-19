import type { Reader } from "./auth";
import { query } from "./db";
import { emailsFrom } from "./loveNote";

// Buddy reads are switched off unless the reader's email is listed in BUDDY_READS_EMAILS.
export const canStartBuddyReads = (reader: Reader) => emailsFrom("BUDDY_READS_EMAILS").includes(reader.email.toLowerCase());

export type Buddy = {
  name: string;
  image: string | null;
  page: number;
  totalPages: number | null;
  // their notes up to the page this reader has reached; later ones stay hidden
  notes: { page: number; note: string; created_at: string }[];
  hiddenAhead: number;
};

export type BuddyRead = { id: number; code: string; buddies: Buddy[] };

// The buddy read this book belongs to (if any), with everyone else's progress, spoiler-safe.
export async function buddyReadFor(userId: number, bookId: number, myPage: number): Promise<BuddyRead | null> {
  const [link] = await query<{ id: number; code: string }>(
    `SELECT r.id, r.code FROM buddy_members m JOIN buddy_reads r ON r.id = m.buddy_id
     WHERE m.user_id = $1 AND m.book_id = $2 LIMIT 1`,
    [userId, bookId],
  );
  if (!link) return null;
  const others = await query<{ user_id: number; book_id: number; name: string | null; image: string | null; total_pages: number | null }>(
    `SELECT m.user_id, m.book_id, u.name, u.image, b.total_pages
     FROM buddy_members m JOIN users u ON u.id = m.user_id JOIN books b ON b.id = m.book_id
     WHERE m.buddy_id = $1 AND m.user_id <> $2 ORDER BY m.joined_at`,
    [link.id, userId],
  );
  const buddies: Buddy[] = await Promise.all(
    others.map(async (o) => {
      const sessions = await query<{ page: number; note: string | null; created_at: string }>(
        `SELECT page, note, created_at FROM reading_sessions WHERE book_id = $1 ORDER BY created_at`,
        [o.book_id],
      );
      const withNotes = sessions.filter((s): s is { page: number; note: string; created_at: string } => Boolean(s.note));
      return {
        name: o.name?.split(" ")[0] ?? "Your buddy",
        image: o.image,
        page: Math.max(0, ...sessions.map((s) => s.page)),
        totalPages: o.total_pages,
        notes: withNotes.filter((s) => s.page <= myPage),
        hiddenAhead: withNotes.filter((s) => s.page > myPage).length,
      };
    }),
  );
  return { id: link.id, code: link.code, buddies };
}

export async function buddyReadByCode(code: string) {
  const [row] = await query<{ id: number; title: string; author: string | null; inviter: string | null }>(
    `SELECT r.id, r.title, r.author, u.name AS inviter FROM buddy_reads r JOIN users u ON u.id = r.created_by WHERE r.code = $1`,
    [code],
  );
  return row ?? null;
}
