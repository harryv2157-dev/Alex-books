import Link from "next/link";
import type { Reader } from "@/lib/auth";
import SignOutButton from "./SignOutButton";
import { isNoteEditor } from "@/lib/loveNote";

export default function Header({ reader }: { reader: Reader }) {
  const canEditNote = isNoteEditor(reader);
  return (
    <header className="header">
      <Link href="/" className="brand">
        Alex Books
      </Link>
      <div className="header-right">
        {canEditNote ? (
          <Link href="/note" className="link-btn" aria-label="Edit Alex's note">
            ♥ Note
          </Link>
        ) : null}
        <Link href="/books/new" className="btn btn-primary btn-sm">
          + Add book
        </Link>
        {reader.image ? <img src={reader.image} alt="" className="avatar" referrerPolicy="no-referrer" /> : null}
        <SignOutButton />
      </div>
    </header>
  );
}
