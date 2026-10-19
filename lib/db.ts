import { Pool } from "pg";

declare global {
  // Reused across hot reloads in dev so we don't leak connections.
  var __pool: Pool | undefined;
  var __schemaReady: Promise<void> | undefined;
}

function pool(): Pool {
  if (!global.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    global.__pool = new Pool({
      connectionString: url,
      // Railway's internal network doesn't use SSL; public proxy URLs do.
      ssl: url.includes("railway.internal") || url.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }
  return global.__pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  image       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  author       TEXT,
  total_pages  INTEGER,
  cover_url    TEXT,
  cover_data   BYTEA,
  cover_type   TEXT,
  spine_color  TEXT,
  status       TEXT NOT NULL DEFAULT 'reading',
  rating       INTEGER,
  review       TEXT,
  synthesis    TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS books_user_idx ON books(user_id);
ALTER TABLE books ADD COLUMN IF NOT EXISTS back_data BYTEA;
ALTER TABLE books ADD COLUMN IF NOT EXISTS back_type TEXT;

CREATE TABLE IF NOT EXISTS reading_sessions (
  id          SERIAL PRIMARY KEY,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page        INTEGER NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_book_idx ON reading_sessions(book_id);
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS minutes INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS recap TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS recap_basis TEXT;

CREATE TABLE IF NOT EXISTS recommendations (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items       JSONB NOT NULL,
  basis       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buddy_reads (
  id           SERIAL PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  author       TEXT,
  total_pages  INTEGER,
  cover_url    TEXT,
  created_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS buddy_members (
  buddy_id   INTEGER NOT NULL REFERENCES buddy_reads(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buddy_id, user_id)
);

CREATE TABLE IF NOT EXISTS year_reviews (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  story       TEXT NOT NULL,
  highlights  JSONB NOT NULL,
  basis       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year)
);

CREATE TABLE IF NOT EXISTS love_note (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  message     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS love_notes (
  id            SERIAL PRIMARY KEY,
  message       TEXT NOT NULL,
  show_install  BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at       TIMESTAMPTZ
);
INSERT INTO love_notes (message, show_install, created_at, seen_at)
  SELECT message, true, updated_at, CASE WHEN seen_at >= updated_at THEN seen_at END FROM love_note
  WHERE NOT EXISTS (SELECT 1 FROM love_notes);
`;

function ready(): Promise<void> {
  if (!global.__schemaReady) {
    global.__schemaReady = pool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
        global.__schemaReady = undefined;
        throw err;
      });
  }
  return global.__schemaReady;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const res = await pool().query(text, params);
  return res.rows as T[];
}
