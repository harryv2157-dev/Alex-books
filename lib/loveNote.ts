import type { Reader } from "./auth";
import { query } from "./db";

export const DEFAULT_LOVE_NOTE = `hey Alex ♥
love you, hope your having a good day

updated the voice recording so let me know if it works.

miss you x :)`;

export type LoveNote = {
  id: number | null; // null = the built-in first note, not saved yet
  message: string;
  showInstall: boolean;
  createdAt: string | null;
  seenAt: string | null;
};

// Tolerates stray quotes, spaces, capitals and comma-separated lists in the Railway setting.
export const emailsFrom = (name: string): string[] =>
  (process.env[name] ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.replace(/^["'<]+|["'>]+$/g, "").trim().toLowerCase())
    .filter((e) => e.includes("@"));

// The reader who sees the note (LOVE_NOTE_EMAIL) and the one who can edit it (LOVE_NOTE_EDITOR_EMAIL).
export const isNoteRecipient = (reader: Reader) => emailsFrom("LOVE_NOTE_EMAIL").includes(reader.email.toLowerCase());
export const isNoteEditor = (reader: Reader) => emailsFrom("LOVE_NOTE_EDITOR_EMAIL").includes(reader.email.toLowerCase());

type Row = { id: number; message: string; show_install: boolean; created_at: Date; seen_at: Date | null };
const toNote = (r: Row): LoveNote => ({
  id: r.id,
  message: r.message,
  showInstall: r.show_install,
  createdAt: r.created_at.toISOString(),
  seenAt: r.seen_at ? r.seen_at.toISOString() : null,
});

// The note she sees is always the newest one.
export async function getLoveNote(): Promise<LoveNote> {
  const [row] = await query<Row>(`SELECT * FROM love_notes ORDER BY created_at DESC, id DESC LIMIT 1`);
  return row ? toNote(row) : { id: null, message: DEFAULT_LOVE_NOTE, showInstall: true, createdAt: null, seenAt: null };
}

export async function listLoveNotes(): Promise<LoveNote[]> {
  const rows = await query<Row>(`SELECT * FROM love_notes ORDER BY created_at DESC, id DESC LIMIT 30`);
  return rows.map(toNote);
}
