"use client";

import { useDictation } from "./useDictation";

export default function NoteField({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  const dictation = useDictation(value, onChange);

  return (
    <div className="note-field">
      <div className="note-box">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={dictation.listening ? "Listening…" : placeholder}
          rows={rows}
          readOnly={dictation.listening}
        />
        <button
          type="button"
          className={`mic ${dictation.listening ? "mic-on" : ""}`}
          onClick={dictation.listening ? dictation.stop : dictation.start}
        >
          {dictation.listening ? "■ Stop" : "🎙 Speak"}
        </button>
      </div>
      {dictation.error ? <p className="error small">{dictation.error}</p> : null}
    </div>
  );
}
