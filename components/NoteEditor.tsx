"use client";

import { useState, useTransition } from "react";
import { saveLoveNote } from "@/app/actions";
import { NoteMessage } from "./LoveNote";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function NoteEditor({
  message,
  updatedAt,
  seenAt,
}: {
  message: string;
  updatedAt: string | null;
  seenAt: string | null;
}) {
  const [text, setText] = useState(message);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const changed = text.trim() !== message.trim();

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="note-status card">
        <span className={`dot ${seenAt ? "read" : ""}`} />
        {seenAt
          ? `Alex acknowledged it ${when(seenAt)}`
          : updatedAt
            ? `Not read yet — it'll pop up next time she opens her shelf`
            : "Not read yet — she'll see it next time she opens her shelf"}
      </p>

      <form
        className="card form note-editor"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            try {
              await saveLoveNote(text);
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            } catch (err) {
              setError((err as Error).message);
            }
          });
        }}
      >
        <label>
          Your message
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} />
        </label>
        <p className="muted small">
          The first line is the big heading. Leave an empty line between paragraphs. Saving shows it to her again.
        </p>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" disabled={pending || (!changed && !saved)}>
          {pending ? "Saving…" : saved ? "Saved ✓ — she'll see it next time" : "Save & show it to her"}
        </button>
      </form>

      <div>
        <p className="muted small" style={{ marginBottom: 8 }}>
          Preview
        </p>
        <div className="love-note note-preview">
          <NoteMessage message={text || " "} />
        </div>
      </div>
    </div>
  );
}
