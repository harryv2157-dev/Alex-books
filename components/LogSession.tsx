"use client";

import { useEffect, useState, useTransition } from "react";
import { logSession } from "@/app/actions";
import { useTidyDictation } from "./useTidyDictation";

type Timer = { startedAt: number | null; savedMs: number };

const timerKey = (bookId: number) => `alexbooks:timer:${bookId}`;

// The reading timer survives leaving the page or locking the phone.
function loadTimer(bookId: number): Timer {
  try {
    const raw = localStorage.getItem(timerKey(bookId));
    if (raw) return JSON.parse(raw) as Timer;
  } catch {}
  return { startedAt: null, savedMs: 0 };
}

function storeTimer(bookId: number, t: Timer) {
  try {
    if (!t.startedAt && !t.savedMs) localStorage.removeItem(timerKey(bookId));
    else localStorage.setItem(timerKey(bookId), JSON.stringify(t));
  } catch {}
}

function partOfDay(d: Date) {
  const h = d.getHours();
  return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night";
}

function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

const MicIcon = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

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
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [timer, setTimer] = useState<Timer>({ startedAt: null, savedMs: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [today, setToday] = useState("");
  const dictation = useTidyDictation(bookId, note, setNote);

  useEffect(() => {
    setTimer(loadTimer(bookId));
    const d = new Date();
    setToday(`${d.toLocaleDateString(undefined, { weekday: "long" })} ${partOfDay(d)}`);
  }, [bookId]);

  useEffect(() => {
    if (!timer.startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.startedAt]);

  const updateTimer = (t: Timer) => {
    setTimer(t);
    storeTimer(bookId, t);
    setNow(Date.now());
  };
  const elapsed = timer.savedMs + (timer.startedAt ? now - timer.startedAt : 0);
  const running = Boolean(timer.startedAt);
  const minutes = Math.round(elapsed / 60000);

  const pageNum = page ? Number(page) : null;
  const read = pageNum !== null ? Math.max(0, pageNum - currentPage) : 0;
  const pctNow = totalPages ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : null;
  const pctNew = totalPages && pageNum !== null ? Math.min(100, Math.round((pageNum / totalPages) * 100)) : null;

  const save = () => {
    setError(null);
    if (pageNum === null || !Number.isFinite(pageNum)) return setError("Which page did you get to?");
    if (totalPages && pageNum > totalPages) return setError(`This book only has ${totalPages} pages.`);
    if (dictation.listening) dictation.stop();
    start(async () => {
      try {
        await logSession(bookId, pageNum, note, minutes || null);
        setSaved(
          minutes
            ? `Saved: ${read} pages in ${minutes} min`
            : `Saved: ${read} page${read === 1 ? "" : "s"}`,
        );
        setPage("");
        setNote("");
        dictation.clearUndo();
        updateTimer({ startedAt: null, savedMs: 0 });
        setTimeout(() => setSaved(null), 4000);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="journal-log">
      <div className="jl-head">
        <span className="jl-eyebrow">{today || " "}</span>
        {pctNow !== null ? (
          <div className="jl-progress">
            <div className="jl-bar" aria-hidden="true">
              <i style={{ width: `${pctNow}%` }} />
              {pctNew !== null && pctNew > pctNow ? <b style={{ left: `${pctNow}%`, width: `${pctNew - pctNow}%` }} /> : null}
            </div>
            <span>
              <strong>{pctNew !== null && pctNew > pctNow ? `${pctNow}% → ${pctNew}%` : `${pctNow}%`}</strong> · page{" "}
              {currentPage} of {totalPages}
            </span>
          </div>
        ) : (
          <span className="jl-sub">Last time: page {currentPage}</span>
        )}
      </div>

      <div className="jl-timer">
        <div>
          <span className="jl-eyebrow">Reading time</span>
          <span className="jl-clock">{clock(elapsed)}</span>
        </div>
        <div className="row">
          {elapsed > 0 && !running ? (
            <button type="button" className="jl-link" onClick={() => updateTimer({ startedAt: null, savedMs: 0 })}>
              Reset
            </button>
          ) : null}
          <button
            type="button"
            className={`jl-pill ${running ? "is-running" : ""}`}
            onClick={() =>
              updateTimer(
                running
                  ? { startedAt: null, savedMs: elapsed }
                  : { startedAt: Date.now(), savedMs: timer.savedMs },
              )
            }
          >
            {running ? "Stop reading" : elapsed > 0 ? "Keep reading" : "Start reading"}
          </button>
        </div>
      </div>

      <label className="jl-page">
        <span>I got to page</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={page}
          onChange={(e) => setPage(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder={String(currentPage || "")}
          aria-label="Page you got to"
        />
      </label>
      {pageNum !== null && read > 0 ? (
        <p className="jl-pace">
          +{read} page{read === 1 ? "" : "s"}
          {minutes > 0 ? ` in ${minutes} min · about ${Math.round((read / minutes) * 60)} pages an hour` : ""}
        </p>
      ) : null}

      <div className="jl-entry">
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            dictation.clearUndo();
          }}
          readOnly={dictation.listening || dictation.tidying}
          rows={4}
          placeholder="Tap the mic and just talk: what happened, what you loved, what annoyed you. Or type here."
          aria-label="Your thoughts on this part"
        />
        {dictation.listening ? <span className="jl-live">listening…</span> : null}
        {dictation.tidying ? <span className="jl-live">tidying up…</span> : null}
      </div>
      {dictation.canUndo ? (
        <p className="tidied">
          Tidied up by Claude ·{" "}
          <button type="button" className="jl-link" onClick={dictation.undoTidy}>
            Undo
          </button>
        </p>
      ) : null}

      <div className="jl-mic-wrap">
        <div className={`jl-wave ${dictation.listening ? "on" : ""}`} aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <button
          type="button"
          className={`jl-mic ${dictation.listening ? "on" : ""}`}
          onClick={dictation.listening ? dictation.stop : dictation.start}
          aria-label={dictation.listening ? "Stop talking" : "Talk about it"}
        >
          <MicIcon />
        </button>
        <span className="jl-mic-label">
          {dictation.listening ? "Tap to stop" : note ? "Tap to add more" : "Tap to talk"}
        </span>
        {dictation.error ? <p className="error small">{dictation.error}</p> : null}
      </div>

      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        {note ? (
          <button type="button" className="jl-redo" onClick={() => setNote("")}>
            Clear
          </button>
        ) : null}
        <button type="button" className="jl-save" onClick={save} disabled={pending}>
          {pending ? "Saving…" : saved ?? "Save to journal"}
        </button>
      </div>
    </div>
  );
}
