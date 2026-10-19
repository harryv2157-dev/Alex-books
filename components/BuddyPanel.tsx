"use client";

import { useState, useTransition } from "react";
import { leaveBuddyRead, startBuddyRead } from "@/app/actions";
import type { BuddyRead } from "@/lib/buddy";

export default function BuddyPanel({
  bookId,
  read,
  canStart,
  myPage,
}: {
  bookId: number;
  read: BuddyRead | null;
  canStart: boolean;
  myPage: number;
}) {
  const [code, setCode] = useState(read?.code ?? null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const link = code && typeof window !== "undefined" ? `${window.location.origin}/buddy/${code}` : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!read && !canStart) return null;

  return (
    <section className="card buddy">
      <h2>Buddy read</h2>
      {read && read.buddies.length > 0 ? (
        <div className="stack" style={{ gap: 14 }}>
          {read.buddies.map((b) => (
            <div key={b.name} className="stack" style={{ gap: 8 }}>
              <div className="row">
                {b.image ? <img src={b.image} alt="" className="avatar" referrerPolicy="no-referrer" /> : null}
                <strong>{b.name}</strong>
                <span className="muted small">
                  page {b.page}
                  {b.totalPages ? ` of ${b.totalPages}` : ""}
                  {b.page > myPage ? " · ahead of you" : b.page < myPage ? " · behind you" : " · same page"}
                </span>
              </div>
              {b.notes.length ? (
                <ol className="journal">
                  {b.notes
                    .slice()
                    .reverse()
                    .map((n, i) => (
                      <li key={i}>
                        <div className="journal-meta">
                          <strong>Page {n.page}</strong>
                        </div>
                        <p className="journal-note">{n.note}</p>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="muted small">No notes up to your page yet.</p>
              )}
              {b.hiddenAhead > 0 ? (
                <p className="muted small">
                  {b.hiddenAhead} more note{b.hiddenAhead === 1 ? "" : "s"} from later in the book. They unlock when you get there.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : code ? (
        <p className="muted">Waiting for someone to join. Send them this link:</p>
      ) : (
        <p className="muted">Read this with someone: you&rsquo;ll see each other&rsquo;s page and notes, but only up to where you&rsquo;ve both got to.</p>
      )}

      {code ? (
        <div className="invite">
          <input readOnly value={link ?? ""} aria-label="Invite link" onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn-sm" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                setCode(await startBuddyRead(bookId));
              } catch (err) {
                setError((err as Error).message);
              }
            })
          }
        >
          {pending ? "Setting up…" : "Start a buddy read"}
        </button>
      )}
      {read ? (
        <button type="button" className="link-btn small" onClick={() => start(() => leaveBuddyRead(bookId))}>
          Leave this buddy read
        </button>
      ) : null}
      {error ? <p className="error small">{error}</p> : null}
    </section>
  );
}
