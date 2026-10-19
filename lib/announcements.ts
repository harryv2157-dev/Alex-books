import { query } from "./db";

// "What's new" notes shown once to every reader. Add a new entry (with a new key) to announce more.
export const ANNOUNCEMENT = {
  key: "2026-10-new-features",
  title: "New in your library",
  intro: "A few new things to try:",
  items: [
    { name: "Tidier voice notes", text: "When you stop talking, your note gets punctuation and any misheard names fixed. Tap Undo if you'd rather keep it as spoken." },
    { name: "Where was I?", text: "On any book with notes, get a quick, spoiler-free reminder of where you got to, written from your own notes." },
    { name: "Reading timer", text: "Start the timer when you log a session to see how long you read and your pages per hour." },
    { name: "What to read next", text: "Book picks based on what you loved and wrote about. In the ⚙️ menu." },
    { name: "Reading stats", text: "Your pages, time, streaks and your year in books, written up. Also in the ⚙️ menu." },
    { name: "Can't find a book?", text: "If search doesn't find it, add it yourself with a photo of the cover." },
  ],
} as const;

export type Announcement = typeof ANNOUNCEMENT;

export async function unreadAnnouncement(userId: number): Promise<Announcement | null> {
  const [row] = await query(`SELECT 1 FROM announcement_reads WHERE user_id = $1 AND key = $2`, [userId, ANNOUNCEMENT.key]);
  return row ? null : ANNOUNCEMENT;
}

export async function announcementReaders(): Promise<{ name: string; read: boolean }[]> {
  return query<{ name: string; read: boolean }>(
    `SELECT COALESCE(u.name, u.email) AS name, (r.user_id IS NOT NULL) AS read
     FROM users u LEFT JOIN announcement_reads r ON r.user_id = u.id AND r.key = $1
     ORDER BY read DESC, u.created_at`,
    [ANNOUNCEMENT.key],
  );
}
