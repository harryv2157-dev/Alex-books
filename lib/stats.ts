import { query } from "./db";

// Every session with how many pages it covered (relative to the session before it on the same book).
const SESSIONS = `
  WITH s AS (
    SELECT s.id, s.book_id, s.page, s.minutes, s.created_at,
           GREATEST(0, s.page - COALESCE(LAG(s.page) OVER (PARTITION BY s.book_id ORDER BY s.created_at, s.id), 0))::int AS read
    FROM reading_sessions s JOIN books b ON b.id = s.book_id
    WHERE b.user_id = $1
  )`;

type Totals = { sessions: number; pages: number; minutes: number; timedPages: number };

async function totals(userId: number, yearFilter: string, params: unknown[]): Promise<Totals> {
  const [row] = await query<{ sessions: number; pages: number; minutes: number; timed_pages: number }>(
    `${SESSIONS}
     SELECT COUNT(*)::int AS sessions, COALESCE(SUM(read), 0)::int AS pages,
            COALESCE(SUM(minutes), 0)::int AS minutes,
            COALESCE(SUM(CASE WHEN minutes > 0 THEN read END), 0)::int AS timed_pages
     FROM s WHERE true ${yearFilter}`,
    [userId, ...params],
  );
  return { sessions: row.sessions, pages: row.pages, minutes: row.minutes, timedPages: row.timed_pages };
}

export type YearStats = Totals & {
  year: number;
  booksFinished: number;
  booksStarted: number;
  favourite: { id: number; title: string; author: string | null; rating: number } | null;
  longest: { id: number; title: string; pages: number } | null;
  busiestMonth: { month: string; pages: number } | null;
};

export async function yearStats(userId: number, year: number): Promise<YearStats> {
  const t = await totals(userId, "AND EXTRACT(YEAR FROM created_at) = $2", [year]);
  const [counts] = await query<{ finished: number; started: number }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'finished' AND EXTRACT(YEAR FROM finished_at) = $2)::int AS finished,
            COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM started_at) = $2)::int AS started
     FROM books WHERE user_id = $1`,
    [userId, year],
  );
  const [favourite] = await query<{ id: number; title: string; author: string | null; rating: number }>(
    `SELECT id, title, author, rating FROM books
     WHERE user_id = $1 AND status = 'finished' AND rating IS NOT NULL AND EXTRACT(YEAR FROM finished_at) = $2
     ORDER BY rating DESC, finished_at DESC LIMIT 1`,
    [userId, year],
  );
  const [longest] = await query<{ id: number; title: string; pages: number }>(
    `SELECT id, title, total_pages AS pages FROM books
     WHERE user_id = $1 AND status = 'finished' AND total_pages IS NOT NULL AND EXTRACT(YEAR FROM finished_at) = $2
     ORDER BY total_pages DESC LIMIT 1`,
    [userId, year],
  );
  const [busiest] = await query<{ month: string; pages: number }>(
    `${SESSIONS}
     SELECT to_char(date_trunc('month', created_at), 'FMMonth') AS month, SUM(read)::int AS pages
     FROM s WHERE EXTRACT(YEAR FROM created_at) = $2
     GROUP BY date_trunc('month', created_at) HAVING SUM(read) > 0 ORDER BY pages DESC LIMIT 1`,
    [userId, year],
  );
  return {
    ...t,
    year,
    booksFinished: counts.finished,
    booksStarted: counts.started,
    favourite: favourite ?? null,
    longest: longest ?? null,
    busiestMonth: busiest ?? null,
  };
}

export type ReadingStats = Totals & {
  booksFinished: number;
  booksReading: number;
  streak: { current: number; best: number };
  weeks: { start: string; pages: number }[]; // last 12 weeks, oldest first
  books: { id: number; title: string; pages: number; minutes: number }[]; // timed books, fastest first
};

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function readingStats(userId: number): Promise<ReadingStats> {
  const t = await totals(userId, "", []);
  const [counts] = await query<{ finished: number; reading: number }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'finished')::int AS finished,
            COUNT(*) FILTER (WHERE status = 'reading')::int AS reading
     FROM books WHERE user_id = $1`,
    [userId],
  );

  // Streak: consecutive days with at least one session.
  const days = (
    await query<{ d: Date }>(
      `SELECT DISTINCT date_trunc('day', s.created_at) AS d FROM reading_sessions s JOIN books b ON b.id = s.book_id
       WHERE b.user_id = $1 ORDER BY d`,
      [userId],
    )
  ).map((r) => day(r.d));
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    const prev = i > 0 ? new Date(days[i - 1]) : null;
    run = prev && new Date(days[i]).getTime() - prev.getTime() === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = day(new Date());
  const yesterday = day(new Date(Date.now() - 86400000));
  const last = days[days.length - 1];
  const current = last === today || last === yesterday ? run : 0;

  const weekRows = await query<{ week: Date; pages: number }>(
    `${SESSIONS}
     SELECT date_trunc('week', created_at) AS week, SUM(read)::int AS pages
     FROM s WHERE created_at >= date_trunc('week', now()) - interval '11 weeks'
     GROUP BY 1`,
    [userId],
  );
  const thisWeek = new Date();
  thisWeek.setUTCHours(0, 0, 0, 0);
  thisWeek.setUTCDate(thisWeek.getUTCDate() - ((thisWeek.getUTCDay() + 6) % 7)); // Monday
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(thisWeek.getTime() - (11 - i) * 7 * 86400000);
    const hit = weekRows.find((w) => day(w.week) === day(start));
    return { start: day(start), pages: hit?.pages ?? 0 };
  });

  const books = await query<{ id: number; title: string; pages: number; minutes: number }>(
    `${SESSIONS}
     SELECT b.id, b.title, SUM(s.read)::int AS pages, SUM(s.minutes)::int AS minutes
     FROM s JOIN books b ON b.id = s.book_id WHERE s.minutes > 0
     GROUP BY b.id, b.title HAVING SUM(s.read) > 0 ORDER BY SUM(s.read)::float / SUM(s.minutes) DESC`,
    [userId],
  );

  return { ...t, booksFinished: counts.finished, booksReading: counts.reading, streak: { current, best }, weeks, books };
}
