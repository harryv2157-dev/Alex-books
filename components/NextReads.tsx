"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getRecommendations, type Recommendation } from "@/app/ai-actions";

export default function NextReads() {
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = (refresh: boolean) =>
    start(async () => {
      setError(null);
      const res = await getRecommendations(refresh);
      if (res.ok) setItems(res.value.items);
      else setError(res.error);
    });

  useEffect(() => load(false), []); // cached picks come back instantly; new ones take a few seconds

  return (
    <div className="stack" style={{ gap: 12 }}>
      {pending && !items ? <p className="muted">Thinking about what you&rsquo;d love…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {items?.map((r) => (
        <article key={r.title} className="rec card">
          {r.coverUrl ? <img src={r.coverUrl} alt="" className="rec-cover" /> : <div className="rec-cover cover-empty">{r.title}</div>}
          <div className="stack" style={{ gap: 6, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>{r.title}</h2>
            <span className="muted small">
              {r.author}
              {r.pages ? ` · ${r.pages} pages` : ""}
            </span>
            <p className="rec-why">{r.why}</p>
            <Link className="link-btn" href={`/books/new?q=${encodeURIComponent(`${r.title} ${r.author}`)}`}>
              Add to my shelf
            </Link>
          </div>
        </article>
      ))}
      {items ? (
        <button className="btn" onClick={() => load(true)} disabled={pending}>
          {pending ? "Finding more…" : "Suggest different books"}
        </button>
      ) : null}
    </div>
  );
}
