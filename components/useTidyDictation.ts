"use client";

import { useRef, useState } from "react";
import { tidyNote } from "@/app/ai-actions";
import { joinNote, useDictation } from "./useDictation";

// Voice dictation where Claude tidies up what was just spoken (punctuation, misheard names), with an undo.
export function useTidyDictation(bookId: number | undefined, value: string, onChange: (text: string) => void) {
  const [tidying, setTidying] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const dictation = useDictation(value, (t) => {
    setUndo(null);
    onChange(t);
  }, (base, spoken) => {
    if (!bookId) return;
    const raw = joinNote(base, spoken);
    setTidying(true);
    tidyNote(bookId, spoken)
      .then((res) => {
        // Only swap it in if she hasn't edited the note in the meantime.
        if (res.ok && res.value && valueRef.current === raw && res.value !== spoken) {
          onChange(joinNote(base, res.value));
          setUndo(raw);
        }
      })
      .catch(() => {})
      .finally(() => setTidying(false));
  });

  return {
    ...dictation,
    tidying,
    canUndo: undo !== null,
    undoTidy: () => {
      if (undo !== null) onChange(undo);
      setUndo(null);
    },
    clearUndo: () => setUndo(null),
  };
}
