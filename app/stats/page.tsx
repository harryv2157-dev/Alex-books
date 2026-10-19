import Link from "next/link";
import { requireReader } from "@/lib/auth";
import { readingStats } from "@/lib/stats";
import { formatMinutes } from "@/lib/format";
import Header from "@/components/Header";
import PagesChart from "@/components/PagesChart";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const reader = await requireReader();
  const s = await readingStats(reader.id);
  const pace = s.minutes > 0 && s.timedPages > 0 ? Math.round((s.timedPages / s.minutes) * 60) : null;
  const year = new Date().getFullYear();

  return (
    <>
      <Header reader={reader} />
      <main className="page narrow">
        <h1 className="page-title">Reading stats</h1>

        <section className="tiles">
          <div className="tile">
            <span className="tile-num">{s.booksFinished}</span>
            <span className="tile-label">books finished</span>
          </div>
          <div className="tile">
            <span className="tile-num">{s.pages.toLocaleString()}</span>
            <span className="tile-label">pages read</span>
          </div>
          <div className="tile">
            <span className="tile-num">{s.minutes ? formatMinutes(s.minutes) : "–"}</span>
            <span className="tile-label">time reading</span>
          </div>
          <div className="tile">
            <span className="tile-num">{pace ?? "–"}</span>
            <span className="tile-label">pages an hour</span>
          </div>
          <div className="tile">
            <span className="tile-num">
              {s.streak.current} day{s.streak.current === 1 ? "" : "s"}
            </span>
            <span className="tile-label">streak · best {s.streak.best}</span>
          </div>
          <div className="tile">
            <span className="tile-num">{s.sessions}</span>
            <span className="tile-label">sessions logged</span>
          </div>
        </section>

        <section className="card">
          <h2>Pages per week</h2>
          <PagesChart weeks={s.weeks} />
        </section>

        {s.books.length > 0 ? (
          <section className="card">
            <h2>Your pace by book</h2>
            <ol className="pace-list">
              {s.books.map((b) => (
                <li key={b.id}>
                  <Link href={`/books/${b.id}`}>{b.title}</Link>
                  <span>
                    {Math.round((b.pages / b.minutes) * 60)} pages/hr · {formatMinutes(b.minutes)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="muted small">From sessions where you used the reading timer.</p>
          </section>
        ) : null}

        <div className="link-cards">
          <Link href="/year" className="link-card">
            <span className="link-card-title">Your {year} in books</span>
            <span className="muted small">Your reading year, written up</span>
          </Link>
          <Link href="/next" className="link-card">
            <span className="link-card-title">What to read next</span>
            <span className="muted small">Picks based on what you loved</span>
          </Link>
        </div>
      </main>
    </>
  );
}
