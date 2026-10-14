"use client";

import { useState, useTransition } from "react";
import { logSession } from "@/app/actions";
import NoteField from "./NoteField";

export default function LogSession({
  bookId,
  currentPage,
  totalPages,
}: {
  bookId: number;
  currentPage: number;
  totalPages: number | null;
}) {
  const [page, setPage] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const n = Number(page);
        if (!page || !Number.isFinite(n)) return setError("Which page did you get to?");
        if (totalPages && n > totalPages) return setError(`This book only has ${totalPages} pages.`);
        start(async () => {
          try {
            await logSession(bookId, n, note);
            setPage("");
            setNote("");
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          } catch (err) {
            setError((err as Error).message);
          }
        });
      }}
    >
      <label>
        I got to page
        <input
          className="page-input"
          inputMode="numeric"
          pattern="[0-9]*"
          value={page}
          onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
          placeholder={currentPage ? String(currentPage) : "73"}
        />
      </label>
      <label>
        Any thoughts? <span className="muted small">(optional — type or tap Speak)</span>
        <NoteField value={note} onChange={setNote} placeholder="What's on your mind about this part of the book?" />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save session"}
      </button>
    </form>
  );
}
