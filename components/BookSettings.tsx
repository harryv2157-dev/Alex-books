"use client";

import { useState, useTransition } from "react";
import { deleteBook, reopenBook, setCoverPhoto, updateBookDetails } from "@/app/actions";
import PhotoPicker from "./PhotoPicker";

export default function BookSettings({
  bookId,
  title,
  author,
  totalPages,
  finished,
}: {
  bookId: number;
  title: string;
  author: string | null;
  totalPages: number | null;
  finished: boolean;
}) {
  const [t, setT] = useState(title);
  const [a, setA] = useState(author ?? "");
  const [p, setP] = useState(totalPages ? String(totalPages) : "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <details className="card settings">
      <summary>Edit book</summary>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await updateBookDetails(bookId, { title: t, author: a, totalPages: p ? Number(p) : null });
            setMsg("Saved");
          });
        }}
      >
        <label>
          Title
          <input value={t} onChange={(e) => setT(e.target.value)} required />
        </label>
        <label>
          Author
          <input value={a} onChange={(e) => setA(e.target.value)} />
        </label>
        <label>
          Number of pages
          <input inputMode="numeric" value={p} onChange={(e) => setP(e.target.value.replace(/\D/g, ""))} />
        </label>
        <button className="btn" disabled={pending}>
          Save details
        </button>
        {msg ? <p className="muted small">{msg}</p> : null}
      </form>
      <div className="row wrap">
        <PhotoPicker
          label="New cover photo"
          onPicked={(photo) =>
            start(async () => {
              await setCoverPhoto(bookId, photo);
              setMsg("Cover updated");
            })
          }
        />
        {finished ? (
          <button className="btn" disabled={pending} onClick={() => start(() => reopenBook(bookId))}>
            I'm reading it again
          </button>
        ) : null}
        <button
          className="btn btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`Remove "${title}" and all its notes from your shelf?`)) start(() => deleteBook(bookId));
          }}
        >
          Delete book
        </button>
      </div>
    </details>
  );
}
