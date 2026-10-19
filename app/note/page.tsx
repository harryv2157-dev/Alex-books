import { notFound } from "next/navigation";
import { requireReader } from "@/lib/auth";
import { getLoveNote, isNoteEditor, listLoveNotes } from "@/lib/loveNote";
import Header from "@/components/Header";
import NoteEditor from "@/components/NoteEditor";
import { ANNOUNCEMENT, announcementReaders } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export default async function NotePage() {
  const reader = await requireReader();
  if (!isNoteEditor(reader)) notFound();
  const [current, history, readers] = await Promise.all([getLoveNote(), listLoveNotes(), announcementReaders()]);
  return (
    <>
      <Header reader={reader} />
      <main className="page narrow">
        <h1 className="page-title">Alex&rsquo;s note</h1>
        <NoteEditor current={current} history={history} />
        <section className="card">
          <h2>&ldquo;{ANNOUNCEMENT.title}&rdquo; note</h2>
          <p className="muted small">Sent to everyone. Alex gets it right after your note.</p>
          <ul className="readers">
            {readers.map((r) => (
              <li key={r.name}>
                <span className={`dot ${r.read ? "read" : ""}`} />
                {r.name} · {r.read ? "read it" : "not yet"}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
