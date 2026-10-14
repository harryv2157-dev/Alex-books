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
  const dictation = useDictation((text) => {
    if (!text) return;
    onChange(value ? `${value.replace(/\s+$/, "")} ${text}` : text.charAt(0).toUpperCase() + text.slice(1));
  });

  return (
    <div className="note-field">
      <div className="note-box">
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
        {dictation.supported ? (
          <button
            type="button"
            className={`mic ${dictation.listening ? "mic-on" : ""}`}
            onClick={dictation.listening ? dictation.stop : dictation.start}
          >
            {dictation.listening ? "■ Stop" : "🎙 Speak"}
          </button>
        ) : null}
      </div>
      {dictation.interim ? <p className="interim">{dictation.interim}…</p> : null}
      {dictation.error ? <p className="error small">{dictation.error}</p> : null}
    </div>
  );
}
