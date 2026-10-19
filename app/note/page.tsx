import { notFound } from "next/navigation";
import { requireReader } from "@/lib/auth";
import { getLoveNote, isNoteEditor } from "@/lib/loveNote";
import Header from "@/components/Header";
import NoteEditor from "@/components/NoteEditor";

export const dynamic = "force-dynamic";

export default async function NotePage() {
  const reader = await requireReader();
  if (!isNoteEditor(reader)) notFound();
  const note = await getLoveNote();
  return (
    <>
      <Header reader={reader} />
      <main className="page narrow">
        <h1 className="page-title">Alex&rsquo;s note</h1>
        <NoteEditor message={note.message} updatedAt={note.updatedAt} seenAt={note.seenAt} />
      </main>
    </>
  );
}
