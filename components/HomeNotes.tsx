"use client";

import { useState } from "react";
import { markAnnouncementRead } from "@/app/actions";
import type { Announcement } from "@/lib/announcements";
import LoveNote from "./LoveNote";

// Pop-ups on opening the app, one at a time: her love note first, then any "what's new" note.
export default function HomeNotes({
  loveNote,
  announcement,
}: {
  loveNote: { message: string; showInstall: boolean; unread: boolean } | null;
  announcement: Announcement | null;
}) {
  const [loveDone, setLoveDone] = useState(!loveNote);
  const [showNews, setShowNews] = useState(true);

  const closeNews = () => {
    setShowNews(false);
    if (announcement) markAnnouncementRead(announcement.key).catch(() => {});
  };

  return (
    <>
      {loveNote ? <LoveNote {...loveNote} onDone={() => setLoveDone(true)} /> : null}
      {loveDone && announcement && showNews ? (
        <div className="overlay" onClick={closeNews}>
          <div className="love-note news-note" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={announcement.title}>
            <h2>{announcement.title}</h2>
            <p className="love-text">{announcement.intro}</p>
            <ul className="news-list">
              {announcement.items.map((it) => (
                <li key={it.name}>
                  <strong>{it.name}</strong>
                  <span>{it.text}</span>
                </li>
              ))}
            </ul>
            <button className="btn btn-primary" onClick={closeNews}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
