"use client";

import { useEffect, useState, useTransition } from "react";
import { sendLoveNote, updateCurrentLoveNote } from "@/app/actions";
import type { LoveNote } from "@/lib/loveNote";
import { LoveNoteCard, NoteMessage, detectPlatform, type Platform } from "./LoveNote";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Status({ note }: { note: LoveNote }) {
  return (
    <span className="note-status">
      <span className={`dot ${note.seenAt ? "read" : ""}`} />
      {note.seenAt ? `Acknowledged ${when(note.seenAt)}` : note.id ? "Waiting for Alex to open it" : "Not sent yet (the starter note)"}
    </span>
  );
}

// Full-screen preview of exactly what pops up on Alex's phone. Acknowledging here changes nothing.
function Preview({ note, onClose }: { note: Pick<LoveNote, "message" | "showInstall">; onClose: () => void }) {
  const [platform, setPlatform] = useState<Platform>("ios");
  useEffect(() => {
    const p = detectPlatform();
    if (p === "android") setPlatform("android");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay preview-overlay" onClick={onClose}>
      <div className="preview-bar" onClick={(e) => e.stopPropagation()}>
        <span>Preview of what Alex sees</span>
        <div className="seg" role="group" aria-label="Her phone">
          {(["ios", "android", "installed"] as const).map((p) => (
            <button key={p} className={platform === p ? "on" : ""} onClick={() => setPlatform(p)}>
              {p === "ios" ? "iPhone" : p === "android" ? "Android" : "App installed"}
            </button>
          ))}
        </div>
      </div>
      <LoveNoteCard message={note.message || " "} showInstall={note.showInstall} platform={platform} onAcknowledge={onClose} />
    </div>
  );
}

export default function NoteEditor({ current, history }: { current: LoveNote; history: LoveNote[] }) {
  const [text, setText] = useState("");
  const [showInstall, setShowInstall] = useState(false);
  const [preview, setPreview] = useState<Pick<LoveNote, "message" | "showInstall"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(current.message);
  const [editInstall, setEditInstall] = useState(current.showInstall);
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>What she sees now</h2>
          <Status note={current} />
        </div>
        {editing ? (
          <div className="form">
            <label>
              Edit the message
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8} />
            </label>
            <label className="check">
              <input type="checkbox" checked={editInstall} onChange={(e) => setEditInstall(e.target.checked)} />
              Include the home-screen steps
            </label>
            <div className="love-note note-preview">
              <NoteMessage message={editText || " "} />
            </div>
            {editError ? <p className="error">{editError}</p> : null}
            <div className="row wrap" style={{ marginTop: 0 }}>
              <button type="button" className="btn" onClick={() => setPreview({ message: editText, showInstall: editInstall })}>
                Preview on her phone
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditing(false);
                  setEditText(current.message);
                  setEditInstall(current.showInstall);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending || !editText.trim()}
                onClick={() =>
                  start(async () => {
                    setEditError(null);
                    try {
                      await updateCurrentLoveNote(editText, editInstall);
                      setEditing(false);
                      setSent("Saved. She'll see the updated note next time she opens the app.");
                      setTimeout(() => setSent(null), 5000);
                    } catch (err) {
                      setEditError((err as Error).message);
                    }
                  })
                }
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="love-note note-preview">
              <NoteMessage message={current.message} />
            </div>
            <p className="muted small">{current.showInstall ? "Shows the home-screen steps underneath." : "No home-screen steps."}</p>
            <div className="row wrap" style={{ marginTop: 0 }}>
              <button className="btn" onClick={() => setPreview(current)}>
                Preview on her phone
              </button>
              <button
                className="btn"
                onClick={() => {
                  setEditText(current.message);
                  setEditInstall(current.showInstall);
                  setEditing(true);
                }}
              >
                Edit this note
              </button>
            </div>
          </>
        )}
        {sent ? <p className="sent-msg">{sent}</p> : null}
      </section>

      <form
        className="card form note-editor"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            try {
              await sendLoveNote(text, showInstall);
              setText("");
              setSent("Sent. It'll pop up next time she opens the app.");
              setTimeout(() => setSent(null), 5000);
            } catch (err) {
              setError((err as Error).message);
            }
          });
        }}
      >
        <h2 style={{ margin: 0 }}>Write a new note</h2>
        <label>
          Your message
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={"morning gorgeous ♥\nhope the book is good today\n\nsee you tonight x"}
          />
        </label>
        <p className="muted small">First line is the big heading. Leave an empty line between paragraphs. Type ♥ for a red heart.</p>
        <label className="check">
          <input type="checkbox" checked={showInstall} onChange={(e) => setShowInstall(e.target.checked)} />
          Include the &ldquo;put it on your home screen&rdquo; steps
        </label>
        {text.trim() ? (
          <div className="love-note note-preview">
            <NoteMessage message={text} />
          </div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="row wrap" style={{ marginTop: 0 }}>
          <button type="button" className="btn" disabled={!text.trim()} onClick={() => setPreview({ message: text, showInstall })}>
            Preview on her phone
          </button>
          <button className="btn btn-primary" disabled={pending || !text.trim()}>
            {pending ? "Sending…" : "Send to Alex"}
          </button>
        </div>
      </form>

      {history.length > 0 ? (
        <section className="card">
          <h2>Past notes</h2>
          <ol className="journal">
            {history.map((n) => (
              <li key={n.id}>
                <div className="journal-meta" style={{ flexWrap: "wrap" }}>
                  <strong>{n.createdAt ? when(n.createdAt) : ""}</strong>
                  <Status note={n} />
                  <button className="link-btn small" style={{ marginLeft: "auto" }} onClick={() => setText(n.message)}>
                    Reuse
                  </button>
                </div>
                <p className="journal-note">{n.message}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {preview ? <Preview note={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
