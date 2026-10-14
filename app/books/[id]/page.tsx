import { notFound } from "next/navigation";
import { requireReader } from "@/lib/auth";
import { getBook, listSessions, progressPercent } from "@/lib/books";
import Header from "@/components/Header";
import LogSession from "@/components/LogSession";
import FinishBook from "@/components/FinishBook";
import Synthesis from "@/components/Synthesis";
import SessionList from "@/components/SessionList";
import BookSettings from "@/components/BookSettings";
import Stars from "@/components/Stars";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const reader = await requireReader();
  const { id } = await params;
  const book = await getBook(reader.id, Number(id));
  if (!book) notFound();
  const sessions = await listSessions(book.id);
  const pct = progressPercent(book);
  const finished = book.status === "finished";

  return (
    <>
      <Header reader={reader} />
      <main className="page narrow">
        <section className="book-head">
          {book.has_cover ? (
            <img src={`/api/cover/${book.id}`} alt="" className="cover-large" />
          ) : (
            <div className="cover-large cover-empty">{book.title}</div>
          )}
          <div className="stack">
            <h1 className="book-title">{book.title}</h1>
            {book.author ? <p className="muted">{book.author}</p> : null}
            {finished ? (
              <>
                <p className="finished-label">
                  Finished {book.finished_at ? new Date(book.finished_at).toLocaleDateString() : ""}
                </p>
                {book.rating ? <Stars value={book.rating} /> : null}
              </>
            ) : (
              <>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="progress-label">
                  {book.total_pages
                    ? `Page ${book.current_page} of ${book.total_pages} · ${pct}%`
                    : `Page ${book.current_page} · add the page count to see your progress`}
                </p>
              </>
            )}
          </div>
        </section>

        {finished ? (
          <>
            <section className="card">
              <h2>Your thoughts</h2>
              <Synthesis bookId={book.id} synthesis={book.synthesis} />
            </section>
            <section className="card">
              <h2>Your review</h2>
              <FinishBook bookId={book.id} rating={book.rating} review={book.review} finished />
            </section>
          </>
        ) : (
          <>
            <section className="card">
              <h2>Log a reading session</h2>
              <LogSession bookId={book.id} currentPage={book.current_page} totalPages={book.total_pages} />
            </section>
          </>
        )}

        <section className="card">
          <h2>Reading journal</h2>
          <SessionList bookId={book.id} sessions={sessions} />
        </section>

        {!finished ? (
          <section className="card">
            <h2>Finished it?</h2>
            <FinishBook bookId={book.id} rating={book.rating} review={book.review} finished={false} />
          </section>
        ) : null}

        <BookSettings
          bookId={book.id}
          title={book.title}
          author={book.author}
          totalPages={book.total_pages}
          finished={finished}
        />
      </main>
    </>
  );
}
