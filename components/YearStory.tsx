"use client";

import { useState, useTransition } from "react";
import { writeYearReview, type YearStory as Story } from "@/app/ai-actions";

export default function YearStory({ year, initial, stale }: { year: number; initial: Story | null; stale: boolean }) {
  const [story, setStory] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const write = () =>
    start(async () => {
      setError(null);
      const res = await writeYearReview(year);
      if (res.ok) setStory(res.value);
      else setError(res.error);
    });

  return (
    <section className="journal-log">
      <span className="jl-eyebrow">Your reading story</span>
      {story ? (
        <>
          {story.themes.length ? (
            <div className="themes">
              {story.themes.map((t) => (
                <span key={t} className="theme">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {story.story.split(/\n\s*\n/).map((p, i) => (
            <p key={i} className="story-p">
              {p}
            </p>
          ))}
          {story.highlights.map((h, i) => (
            <blockquote key={i} className="highlight">
              <p>&ldquo;{h.quote}&rdquo;</p>
              <cite>{h.book}</cite>
            </blockquote>
          ))}
        </>
      ) : (
        <p className="story-p muted-ink">Claude can read back through everything you logged this year and write it up for you.</p>
      )}
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className={story ? "jl-redo" : "jl-save"} onClick={write} disabled={pending}>
        {pending ? "Reading back through your year…" : story ? (stale ? "Update with your latest reading" : "Rewrite it") : "Write my year"}
      </button>
    </section>
  );
}
