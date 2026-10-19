"use client";

import { useTidyDictation } from "./useTidyDictation";

export default function NoteField({
  value,
  onChange,
  placeholder,
  rows = 4,
  bookId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  bookId?: number;
}) {
  const dictation = useTidyDictation(bookId, value, onChange);

  return (
    <div className="note-field">
      <div className="note-box">
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            dictation.clearUndo();
          }}
          placeholder={dictation.listening ? "Listening…" : placeholder}
          rows={rows}
          readOnly={dictation.listening || dictation.tidying}
        />
        <button
          type="button"
          className={`mic ${dictation.listening ? "mic-on" : ""}`}
          onClick={dictation.listening ? dictation.stop : dictation.start}
        >
          {dictation.listening ? "■ Stop" : "🎙 Speak"}
        </button>
      </div>
      {dictation.tidying ? <p className="muted small">Tidying up…</p> : null}
      {dictation.canUndo ? (
        <p className="muted small">
          Tidied up by Claude ·{" "}
          <button type="button" className="link-btn small" onClick={dictation.undoTidy}>
            Undo
          </button>
        </p>
      ) : null}
      {dictation.error ? <p className="error small">{dictation.error}</p> : null}
    </div>
  );
}
