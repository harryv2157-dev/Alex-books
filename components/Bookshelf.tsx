"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Book } from "@/lib/books";
import { saveSpineColor } from "@/app/actions";
import { spineColorFrom } from "@/lib/image";
import Stars from "./Stars";

const FALLBACK_COLORS = ["#7a2e2e", "#2f4a3a", "#2b3f63", "#6b4a1f", "#4b2f5c", "#3d5a5a", "#704050", "#5a5a2a"];

function hash(n: number) {
  return Math.abs(Math.sin(n * 9301 + 49297)) % 1;
}

function percent(b: Book) {
  if (b.status === "finished") return 100;
  return b.total_pages ? Math.min(100, Math.round((b.current_page / b.total_pages) * 100)) : 0;
}

function spineWidth(b: Book) {
  const pages = b.total_pages ?? 300;
  return Math.round(Math.max(34, Math.min(64, 26 + pages / 14)));
}

function spineHeight(b: Book) {
  return Math.round(150 + hash(b.id) * 40);
}

export default function Bookshelf({ books }: { books: Book[] }) {
  const [colors, setColors] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<Book | null>(null);
  const [rows, setRows] = useState<Book[][]>([books]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Work out spine colours from cover photos we haven't coloured yet.
  useEffect(() => {
    for (const b of books) {
      if (b.spine_color || !b.has_cover) continue;
      const img = new Image();
      img.onload = () => {
        const c = spineColorFrom(img);
        if (!c) return;
        setColors((prev) => ({ ...prev, [b.id]: c }));
        saveSpineColor(b.id, c).catch(() => {});
      };
      img.src = `/api/cover/${b.id}`;
    }
  }, [books]);

  // Split the books onto shelves that fit the screen width.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const layout = () => {
      const max = el.clientWidth - 32;
      const next: Book[][] = [[]];
      let used = 0;
      for (const b of books) {
        const w = spineWidth(b) + 4;
        if (used + w > max && next[next.length - 1].length > 0) {
          next.push([]);
          used = 0;
        }
        next[next.length - 1].push(b);
        used += w;
      }
      setRows(next);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    return () => ro.disconnect();
  }, [books]);

  const colorFor = (b: Book) => b.spine_color ?? colors[b.id] ?? FALLBACK_COLORS[b.id % FALLBACK_COLORS.length];

  return (
    <>
      <div className="bookcase" ref={wrapRef}>
        {rows.map((row, i) => (
          <div className="shelf" key={i}>
            <div className="shelf-books">
              {row.map((b) => (
                <button
                  key={b.id}
                  className="spine"
                  style={
                    {
                      "--spine": colorFor(b),
                      width: spineWidth(b),
                      height: spineHeight(b),
                    } as React.CSSProperties
                  }
                  onClick={() => setOpen(b)}
                  aria-label={`${b.title}${b.author ? ` by ${b.author}` : ""}`}
                >
                  <span className="spine-title">{b.title}</span>
                  {b.author ? <span className="spine-author">{b.author.split(" ").slice(-1)[0]}</span> : null}
                  <span className="spine-progress" style={{ height: `${percent(b)}%` }} />
                  {b.status === "finished" ? <span className="spine-done" aria-hidden>★</span> : null}
                </button>
              ))}
            </div>
            <div className="shelf-board" />
          </div>
        ))}
      </div>
      {open ? <OpenBook book={open} color={colorFor(open)} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function OpenBook({ book, color, onClose }: { book: Book; color: string; onClose: () => void }) {
  const [opened, setOpened] = useState(false);
  const pct = percent(book);

  useEffect(() => {
    const t = setTimeout(() => setOpened(true), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className={`book3d ${opened ? "is-open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="book3d-page">
          <h2>{book.title}</h2>
          {book.author ? <p className="muted">{book.author}</p> : null}

          {book.status === "finished" ? (
            <>
              <p className="finished-label">Finished</p>
              {book.rating ? <Stars value={book.rating} /> : null}
              {book.synthesis ? (
                <p className="excerpt">{book.synthesis.split("\n")[0]}</p>
              ) : book.review ? (
                <p className="excerpt">{book.review}</p>
              ) : null}
            </>
          ) : (
            <>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="progress-label">
                {book.total_pages
                  ? `Page ${book.current_page} of ${book.total_pages} · ${pct}%`
                  : `Page ${book.current_page}`}
              </p>
              {book.last_note ? <p className="excerpt">“{book.last_note}”</p> : null}
              <p className="muted small">
                {book.session_count === 0
                  ? "No sessions logged yet"
                  : `${book.session_count} reading session${book.session_count === 1 ? "" : "s"}`}
              </p>
            </>
          )}

          <Link href={`/books/${book.id}`} className="btn btn-primary">
            {book.status === "finished" ? "See your thoughts" : "Log a session"}
          </Link>
        </div>
        <div className="book3d-cover" style={{ "--spine": color } as React.CSSProperties}>
          <div className="book3d-front">
            {book.has_cover ? (
              <img src={`/api/cover/${book.id}`} alt="" />
            ) : (
              <div className="cover-fallback">
                <span>{book.title}</span>
                {book.author ? <small>{book.author}</small> : null}
              </div>
            )}
          </div>
          <div className="book3d-inside">
            <span>{book.title}</span>
          </div>
        </div>
      </div>
      <button className="overlay-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
