import Link from "next/link";
import { requireReader } from "@/lib/auth";
import { query } from "@/lib/db";
import { yearStats } from "@/lib/stats";
import { formatMinutes } from "@/lib/format";
import Header from "@/components/Header";
import YearStory from "@/components/YearStory";
import type { YearStory as Story } from "@/app/ai-actions";

export const dynamic = "force-dynamic";

export default async function YearPage() {
  const reader = await requireReader();
  const year = new Date().getFullYear();
  const s = await yearStats(reader.id, year);
  const [saved] = await query<{ story: string; highlights: { themes: string[]; highlights: Story["highlights"] }; basis: string }>(
    `SELECT story, highlights, basis FROM year_reviews WHERE user_id = $1 AND year = $2`,
    [reader.id, year],
  );
  const story: Story | null = saved ? { story: saved.story, ...saved.highlights } : null;
  const stale = Boolean(saved && saved.basis !== String(s.sessions));

  return (
    <>
      <Header reader={reader} />
      <main className="page narrow wrapped">
        <section className="wrapped-hero">
          <span className="jl-eyebrow">Your year in books</span>
          <h1>{year}</h1>
          <p>{s.booksFinished === 1 ? "1 book finished" : `${s.booksFinished} books finished`} so far</p>
        </section>

        <section className="wrapped-grid">
          <div className="wrapped-card">
            <span className="tile-num">{s.pages.toLocaleString()}</span>
            <span className="tile-label">pages read</span>
          </div>
          <div className="wrapped-card">
            <span className="tile-num">{s.minutes ? formatMinutes(s.minutes) : "–"}</span>
            <span className="tile-label">spent reading</span>
          </div>
          <div className="wrapped-card">
            <span className="tile-num">{s.booksStarted}</span>
            <span className="tile-label">books started</span>
          </div>
          <div className="wrapped-card">
            <span className="tile-num">{s.busiestMonth?.month ?? "–"}</span>
            <span className="tile-label">{s.busiestMonth ? `busiest month · ${s.busiestMonth.pages} pages` : "busiest month"}</span>
          </div>
        </section>

        {s.favourite ? (
          <Link href={`/books/${s.favourite.id}`} className="wrapped-fav">
            <span className="jl-eyebrow">Favourite of the year</span>
            <span className="wrapped-fav-title">{s.favourite.title}</span>
            <span className="stars" aria-label={`${s.favourite.rating} stars`}>
              {"★".repeat(s.favourite.rating)}
            </span>
          </Link>
        ) : null}
        {s.longest ? (
          <p className="muted">
            Longest book finished: <Link href={`/books/${s.longest.id}`}>{s.longest.title}</Link> ({s.longest.pages} pages)
          </p>
        ) : null}

        <YearStory year={year} initial={story} stale={stale} />
      </main>
    </>
  );
}
