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
const isIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
const isAndroid = () => typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
const standalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

function blockedHelp(): string {
  if (isIOS()) {
    return standalone()
      ? "Microphone is blocked for this app. Open iPhone Settings → Apps → Safari → Microphone → Allow (or Ask), then tap Speak again."
      : "Microphone is blocked for this site. In Safari, tap the aA button in the address bar → Website Settings → Microphone → Allow, then tap Speak again.";
  }
  if (isAndroid()) {
    return "Microphone is blocked for this site. In Chrome, tap the icon to the left of the web address → Permissions → Microphone → Allow, then tap Speak again. If that's already on, check Android Settings → Apps → Chrome → Permissions → Microphone.";
  }
  return "Microphone is blocked for this site. Click the icon to the left of the web address, allow the microphone, then try again.";
}

// Explains a "not allowed" error: a real block in settings, or (on iPhone) Dictation being switched off.
async function notAllowedHelp(code: string): Promise<string> {
  if (code === "service-not-allowed" && isIOS()) {
    return "Voice notes need iPhone Dictation. Turn it on in Settings → General → Keyboard → Enable Dictation, then tap Speak again.";
  }
  try {
    const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    if (status && status.state !== "denied") return "The phone didn't let the microphone start. Tap Speak again and choose Allow if asked.";
  } catch {}
  return blockedHelp();
}

export function useDictation(value: string, onChange: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const stop = useCallback(() => rec.current?.stop(), []);

  // Must stay synchronous: phones only let listening start directly from the tap, and starting it
  // is what makes the browser show its microphone permission prompt.
  const start = useCallback(() => {
    const Ctor = getRecognition();
    setError(null);
    if (!Ctor) {
      setError(
        isIOS() && standalone()
          ? "Voice notes don't work from the home-screen app on this iPhone. Open the site in Safari to talk, or type your note."
          : "Voice notes don't work in this browser. On iPhone use Safari; on Android use Chrome. You can still type your note.",
      );
      return;
    }
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
        notAllowedHelp(e.error).then(setError);
      } else if (e.error === "audio-capture") {
        setError("No microphone could be used. Is another app (like a call) using it?");
      } else if (e.error === "network") {
        setError("Voice notes need an internet connection. Check you're online and try again.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Couldn't hear that. Try again.");
      }
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Voice notes couldn't start. Try again.");
    }
  }, []);

  useEffect(() => () => rec.current?.stop(), []);

  return { listening, error, start, stop };
}
