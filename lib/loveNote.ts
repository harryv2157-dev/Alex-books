import type { Reader } from "./auth";
import { query } from "./db";

export const DEFAULT_LOVE_NOTE = `hey Alex ♥
love you, hope your having a good day

updated the voice recording so let me know if it works.

miss you x :)`;

export type LoveNoteState = {
  message: string;
  updatedAt: string | null;
  // When she last closed the note, if that was after the latest edit.
  seenAt: string | null;
};

const email = (name: string) => process.env[name]?.trim().toLowerCase() || null;

// The one reader who sees the note (LOVE_NOTE_EMAIL) and the one who can edit it (LOVE_NOTE_EDITOR_EMAIL).
export const isNoteRecipient = (reader: Reader) => reader.email.toLowerCase() === email("LOVE_NOTE_EMAIL");
export const isNoteEditor = (reader: Reader) => reader.email.toLowerCase() === email("LOVE_NOTE_EDITOR_EMAIL");

export async function getLoveNote(): Promise<LoveNoteState> {
  const [row] = await query<{ message: string; updated_at: Date; seen_at: Date | null }>(
    `SELECT message, updated_at, seen_at FROM love_note WHERE id = 1`,
  );
  if (!row) return { message: DEFAULT_LOVE_NOTE, updatedAt: null, seenAt: null };
  const seen = row.seen_at && row.seen_at >= row.updated_at ? row.seen_at.toISOString() : null;
  return { message: row.message, updatedAt: row.updated_at.toISOString(), seenAt: seen };
}
