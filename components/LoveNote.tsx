"use client";

import { useEffect, useState } from "react";
import { markLoveNoteSeen } from "@/app/actions";

export type Platform = "ios" | "android" | "installed" | "other";

export function detectPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

// Hearts are drawn in red.
function withHearts(text: string) {
  return text.split(/(♥|❤️?)/u).map((part, i) =>
    /^(♥|❤️?)$/u.test(part) ? (
      <span key={i} className="love-heart">
        ♥
      </span>
    ) : (
      part
    ),
  );
}

// First line is the greeting; blank lines separate paragraphs.
export function NoteMessage({ message }: { message: string }) {
  const [first, ...rest] = message.trim().split("\n");
  const paragraphs = rest.join("\n").trim().split(/\n\s*\n/).filter(Boolean);
  return (
    <>
      <h2>{withHearts(first)}</h2>
      {paragraphs.map((p, i) => (
        <p key={i} className="love-text">
          {withHearts(p)}
        </p>
      ))}
    </>
  );
}

// The note card exactly as Alex sees it. Used for the real pop-up and for Harry's preview.
export function LoveNoteCard({
  message,
  showInstall,
  platform,
  onAcknowledge,
}: {
  message: string;
  showInstall: boolean;
  platform: Platform;
  onAcknowledge: () => void;
}) {
  return (
    <div className="love-note" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="A note for you">
      <NoteMessage message={message} />

      {showInstall && platform !== "installed" ? (
        <div className="love-steps">
          <h3>how to add this as a full screen app on your home screen x</h3>
          {platform === "ios" ? (
            <ol>
              <li>Open this page in <strong>Safari</strong>.</li>
              <li>Tap the <strong>Share</strong> button (the square with an arrow pointing up).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
              <li>Open it from the new icon and it fills the whole screen like a normal app.</li>
            </ol>
          ) : (
            <ol>
              <li>Open this page in <strong>Chrome</strong>.</li>
              <li>Tap the <strong>⋮</strong> menu (three dots, top right).</li>
              <li>Tap <strong>Add to Home screen</strong> (it may say <strong>Install app</strong>).</li>
              <li>Tap <strong>Install</strong> (or <strong>Add</strong>), then confirm.</li>
              <li>Open it from the new <strong>Library</strong> icon and it fills the whole screen with no browser bar.</li>
            </ol>
          )}
        </div>
      ) : null}

      <button className="btn btn-primary" onClick={onAcknowledge}>
        Acknowledge
      </button>
    </div>
  );
}

export default function LoveNote({ message, showInstall, unread }: { message: string; showInstall: boolean; unread: boolean }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
    if (unread) setOpen(true);
  }, [unread]);

  const close = () => {
    setOpen(false);
    markLoveNoteSeen().catch(() => {});
  };

  if (!open) return null;
  return (
    <div className="overlay" onClick={close}>
      <LoveNoteCard message={message} showInstall={showInstall} platform={platform} onAcknowledge={close} />
    </div>
  );
}
