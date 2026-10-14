"use client";

import { useEffect, useState, useTransition } from "react";
import { addBook } from "@/app/actions";
import type { SearchResult } from "@/app/api/search/route";
import PhotoPicker from "./PhotoPicker";

type Draft = { title: string; author: string; pages: string; coverUrl: string | null; photo: string | null };

export default function AddBook() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: SearchResult[]; error?: string };
        setResults(data.results);
        if (data.error) setSearchError(data.error);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSearchError("Search failed — you can still add it by hand.");
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (draft) {
    const preview = draft.photo ?? draft.coverUrl;
    return (
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startSaving(async () => {
            try {
              await addBook({
                title: draft.title,
                author: draft.author,
                totalPages: draft.pages ? Number(draft.pages) : null,
                coverUrl: draft.coverUrl,
                photo: draft.photo,
              });
            } catch (err) {
              // redirect() throws on success; only show real errors
              if (!(err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) setError((err as Error).message);
            }
          });
        }}
      >
        <div className="add-cover">
          {preview ? <img src={preview} alt="" className="cover-thumb" /> : <div className="cover-thumb cover-empty">No cover</div>}
          <div className="stack">
            <PhotoPicker
              label={draft.photo ? "Retake photo" : "Take a photo of the cover"}
              onPicked={(photo) => setDraft({ ...draft, photo })}
            />
            <p className="muted small">Your photo becomes the book on your shelf.</p>
          </div>
        </div>
        <label>
          Title
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
        </label>
        <label>
          Author
          <input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
        </label>
        <label>
          Number of pages
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.pages}
            onChange={(e) => setDraft({ ...draft, pages: e.target.value.replace(/\D/g, "") })}
            placeholder="e.g. 352"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button type="button" className="btn" onClick={() => setDraft(null)}>
            Back
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Put it on the shelf"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="stack">
      <input
        className="search"
        placeholder="Search by title or author…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {searching ? <p className="muted small">Searching…</p> : null}
      {searchError ? <p className="error">{searchError}</p> : null}
      <ul className="results">
        {results.map((r) => (
          <li key={r.key}>
            <button
              className="result"
              onClick={() =>
                setDraft({
                  title: r.title,
                  author: r.author ?? "",
                  pages: r.pages ? String(r.pages) : "",
                  coverUrl: r.coverUrl,
                  photo: null,
                })
              }
            >
              {r.coverUrl ? (
                <img src={r.coverUrl.replace("-L.jpg", "-S.jpg")} alt="" />
              ) : (
                <span className="result-nocover" />
              )}
              <span>
                <strong>{r.title}</strong>
                <span className="muted small">
                  {[r.author, r.year, r.pages ? `${r.pages} pages` : null].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        className="link-btn"
        onClick={() => setDraft({ title: q.trim(), author: "", pages: "", coverUrl: null, photo: null })}
      >
        Can't find it? Add it by hand
      </button>
    </div>
  );
}
