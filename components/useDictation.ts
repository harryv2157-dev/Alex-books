"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib everywhere).
type ResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Joins recognised phrases. Some phones (notably Android Chrome) resend everything said so far as a
// new result after a pause, so a phrase that repeats or extends the previous one replaces it.
export function joinPhrases(phrases: string[]): string {
  const out: string[] = [];
  for (const raw of phrases) {
    const p = raw.trim();
    if (!p) continue;
    const prev = out[out.length - 1];
    if (prev !== undefined) {
      const a = norm(prev);
      const b = norm(p);
      if (b.startsWith(a)) {
        out[out.length - 1] = p;
        continue;
      }
      if (a.startsWith(b) || norm(out.join(" ")).endsWith(b)) continue;
    }
    out.push(p);
  }
  return out.join(" ");
}

function joinNote(base: string, spoken: string): string {
  if (!spoken) return base;
  if (!base.trim()) return spoken.charAt(0).toUpperCase() + spoken.slice(1);
  return `${base.replace(/\s+$/, "")} ${spoken}`;
}

// Speak into the phone; the note is rebuilt live (base text + everything heard so far) as words arrive.
export function useDictation(value: string, onChange: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => setSupported(getRecognition() !== null), []);

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    setError(null);
    const base = valueRef.current;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-GB";
    r.onresult = (e) => {
      // Rebuild from the full result list every time instead of appending, so nothing is added twice.
      const phrases: string[] = [];
      for (let i = 0; i < e.results.length; i++) phrases.push(e.results[i][0].transcript);
      onChangeRef.current(joinNote(base, joinPhrases(phrases)));
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access was blocked — allow it in your browser settings.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Couldn't hear that — try again.");
      }
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Voice notes couldn't start — try again.");
    }
  }, []);

  useEffect(() => () => rec.current?.stop(), []);

  return { supported, listening, error, start, stop };
}
