import { query } from "./db";

export type Book = {
  id: number;
  title: string;
  author: string | null;
  total_pages: number | null;
  has_cover: boolean;
  spine_color: string | null;
  status: "reading" | "finished";
  rating: number | null;
  review: string | null;
  synthesis: string | null;
  started_at: string;
  finished_at: string | null;
  current_page: number;
  session_count: number;
  last_note: string | null;
};

export type ReadingSession = {
  id: number;
  page: number;
  note: string | null;
  created_at: string;
};

const BOOK_COLUMNS = `
  b.id, b.title, b.author, b.total_pages, b.spine_color, b.status, b.rating, b.review, b.synthesis,
  b.started_at, b.finished_at,
  (b.cover_data IS NOT NULL OR b.cover_url IS NOT NULL) AS has_cover,
  COALESCE((SELECT MAX(s.page) FROM reading_sessions s WHERE s.book_id = b.id), 0)::int AS current_page,
  (SELECT COUNT(*) FROM reading_sessions s WHERE s.book_id = b.id)::int AS session_count,
  (SELECT s.note FROM reading_sessions s WHERE s.book_id = b.id AND s.note IS NOT NULL
   ORDER BY s.created_at DESC LIMIT 1) AS last_note
`;

export function listBooks(userId: number): Promise<Book[]> {
  return query<Book>(
    `SELECT ${BOOK_COLUMNS} FROM books b WHERE b.user_id = $1
     ORDER BY (b.status = 'finished'), COALESCE(b.finished_at, b.started_at) DESC`,
    [userId],
  );
}

export async function getBook(userId: number, bookId: number): Promise<Book | null> {
  const [book] = await query<Book>(`SELECT ${BOOK_COLUMNS} FROM books b WHERE b.user_id = $1 AND b.id = $2`, [
    userId,
    bookId,
  ]);
  return book ?? null;
}

export function listSessions(bookId: number): Promise<ReadingSession[]> {
  return query<ReadingSession>(
    `SELECT id, page, note, created_at FROM reading_sessions WHERE book_id = $1 ORDER BY created_at DESC`,
    [bookId],
  );
}

export function progressPercent(book: Pick<Book, "current_page" | "total_pages" | "status">): number {
  if (book.status === "finished") return 100;
  if (!book.total_pages) return 0;
  return Math.max(0, Math.min(100, Math.round((book.current_page / book.total_pages) * 100)));
}
