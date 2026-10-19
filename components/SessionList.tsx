"use client";

import { useTransition } from "react";
import { deleteSession } from "@/app/actions";
import type { ReadingSession } from "@/lib/books";
import { formatMinutes } from "@/lib/format";

export default function SessionList({ bookId, sessions }: { bookId: number; sessions: ReadingSession[] }) {
  const [pending, start] = useTransition();
  if (sessions.length === 0) return <p className="muted">Nothing logged yet. Your sessions and notes will show up here.</p>;
  return (
    <ol className="journal">
      {sessions.map((s) => (
        <li key={s.id}>
          <div className="journal-meta">
            <strong>Page {s.page}</strong>
            {s.pages_read > 0 || s.minutes ? (
              <span className="pace">
                {s.pages_read > 0 ? `+${s.pages_read}` : ""}
                {s.minutes ? `${s.pages_read > 0 ? " in " : ""}${formatMinutes(s.minutes)}` : ""}
              </span>
            ) : null}
            <span className="muted small">
              {new Date(s.created_at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <button
              className="link-btn small"
              disabled={pending}
              onClick={() => {
                if (confirm("Delete this session?")) start(() => deleteSession(bookId, s.id));
              }}
            >
              Delete
            </button>
          </div>
          {s.note ? <p className="journal-note">{s.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
