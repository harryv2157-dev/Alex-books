"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "alex-books:love-note-seen";

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

export default function LoveNote({ name }: { name: string | null }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (!seen) setOpen(true);
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setOpen(false);
  };

  return (
    <>
      <button className="love-reopen" onClick={() => setOpen(true)}>
        A note for you ♥
      </button>
      {open ? (
        <div className="overlay" onClick={close}>
          <div className="love-note" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="A note for you">
            <p className="love-heart" aria-hidden>
              ♥
            </p>
            <h2>Hi {name ?? "you"},</h2>
            <p>
              This little library was made just for you, a place for every book you fall into, every page you get to,
              and every thought you have along the way.
            </p>
            <p>
              <strong>You are so very loved.</strong> Happy reading.
            </p>

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
