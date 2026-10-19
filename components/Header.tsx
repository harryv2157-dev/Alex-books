import Link from "next/link";
import type { Reader } from "@/lib/auth";
import HeaderMenu from "./HeaderMenu";
import { isNoteEditor } from "@/lib/loveNote";

export default function Header({ reader }: { reader: Reader }) {
  return (
    <header className="header">
      <Link href="/" className="brand">
        Your Library
      </Link>
      <div className="header-right">
        <Link href="/books/new" className="btn btn-primary btn-sm">
          + Add book
        </Link>
        <HeaderMenu
          name={reader.name}
          image={reader.image}
          canEditNote={isNoteEditor(reader)}
        />
      </div>
    </header>
  );
}
