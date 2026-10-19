"use client";

import { useEffect, useState } from "react";
import { markLoveNoteSeen } from "@/app/actions";

type Platform = "ios" | "android" | "installed" | "other";

function detectPlatform(): Platform {
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

export default function LoveNote({ message, unread }: { message: string; unread: boolean }) {
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

  return (
    <>
      <button className="love-reopen" onClick={() => setOpen(true)}>
        A note for you ♥
      </button>
      {open ? (
        <div className="overlay" onClick={close}>
          <div className="love-note" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="A note for you">
            <NoteMessage message={message} />

            {platform !== "installed" ? (
              <div className="love-steps">
                <h3>Put it on your home screen</h3>
                {platform === "android" ? (
                  <ol>
                    <li>Tap the <strong>⋮</strong> menu in the top corner of Chrome.</li>
                    <li>Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>).</li>
                    <li>Tap <strong>Add</strong>, and it will sit on your phone like any other app.</li>
                  </ol>
                ) : platform === "ios" ? (
                  <ol>
                    <li>Make sure you&rsquo;re in <strong>Safari</strong>.</li>
                    <li>Tap the <strong>Share</strong> button (the square with an arrow pointing up).</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
                  </ol>
                ) : (
                  <p>
                    Open this page on your phone. On iPhone use Safari&rsquo;s Share button then{" "}
                    <strong>Add to Home Screen</strong>; on Android use Chrome&rsquo;s <strong>⋮</strong> menu then{" "}
                    <strong>Add to Home screen</strong>.
                  </p>
                )}
              </div>
            ) : null}

            <button className="btn btn-primary" onClick={close}>
              Take me to my books
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
