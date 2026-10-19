"use client";

import { useState, useTransition } from "react";
import { recapBook } from "@/app/ai-actions";

// A spoiler-free reminder of where she'd got to, written only from her own notes.
export default function WhereWasI({ bookId }: { bookId: number }) {
  const [recap, setRecap] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (refresh = false) =>
    start(async () => {
      setError(null);
      const res = await recapBook(bookId, refresh);
      if (res.ok) setRecap(res.value);
      else setError(res.error);
    });

  if (!recap) {
    return (
      <div className="wwi">
        <button type="button" className="btn" onClick={() => run()} disabled={pending}>
          {pending ? "Reading your notes…" : "Where was I?"}
        </button>
        {error ? <p className="error small">{error}</p> : null}
      </div>
    );
  }
  return (
    <section className="wwi-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="jl-eyebrow">Where you were</span>
        <button type="button" className="jl-link" onClick={() => setRecap(null)} aria-label="Close recap">
          Close
        </button>
      </div>
      <p className="story-p">{recap}</p>
      <span className="muted-ink small">Written only from your own notes, so no spoilers.</span>
    </section>
  );
}
