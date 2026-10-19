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

CREATE TABLE IF NOT EXISTS love_note (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  message     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at     TIMESTAMPTZ
);
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
