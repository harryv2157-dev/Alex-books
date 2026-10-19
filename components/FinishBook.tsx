"use client";

import { useState, useTransition } from "react";
import { finishBook } from "@/app/actions";
import NoteField from "./NoteField";
import Stars from "./Stars";

export default function FinishBook({
  bookId,
  rating,
  review,
  finished,
}: {
  bookId: number;
  rating: number | null;
  review: string | null;
  finished: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState<number | null>(rating);
  const [text, setText] = useState(review ?? "");
  const [pending, start] = useTransition();

  if (finished && !editing) {
    return (
      <div className="stack">
        {review ? <p className="prose">{review}</p> : <p className="muted">No review written yet.</p>}
        <button className="link-btn" onClick={() => setEditing(true)}>
          {review ? "Edit review" : "Write a review"}
        </button>
      </div>
    );
  }

  if (!finished && !open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        I've finished this book
      </button>
    );
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await finishBook(bookId, stars || null, text);
          setEditing(false);
        });
      }}
    >
      <label>
        Your rating
        <Stars value={stars} onChange={setStars} />
      </label>
      <label>
        Your review
        <NoteField value={text} onChange={setText} placeholder="What did you make of it?" rows={6} bookId={bookId} />
      </label>
      <div className="row">
        <button type="button" className="btn" onClick={() => (finished ? setEditing(false) : setOpen(false))}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : finished ? "Save review" : "Mark as finished"}
        </button>
      </div>
    </form>
  );
}
