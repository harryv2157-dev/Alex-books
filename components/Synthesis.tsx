"use client";

import { useState, useTransition } from "react";
import { synthesizeThoughts } from "@/app/actions";

export default function Synthesis({ bookId, synthesis }: { bookId: number; synthesis: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      const res = await synthesizeThoughts(bookId);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="stack">
      {synthesis ? (
        synthesis.split(/\n\s*\n/).map((p, i) => (
          <p className="prose" key={i}>
            {p}
          </p>
        ))
      ) : (
        <p className="muted">
          Pull together everything you noted while reading, plus your review, into one look back at the book.
        </p>
      )}
      {error ? <p className="error">{error}</p> : null}
      <button className={synthesis ? "link-btn" : "btn btn-primary"} onClick={run} disabled={pending}>
        {pending ? "Reading back through your notes…" : synthesis ? "Rewrite it" : "Summarise my thoughts"}
      </button>
    </div>
  );
}
