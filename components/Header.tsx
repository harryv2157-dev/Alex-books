import Link from "next/link";
import type { Reader } from "@/lib/auth";
import SignOutButton from "./SignOutButton";

export default function Header({ reader }: { reader: Reader }) {
  return (
    <header className="header">
      <Link href="/" className="brand">
        Alex Books
      </Link>
      <div className="header-right">
        <Link href="/books/new" className="btn btn-primary btn-sm">
          + Add book
        </Link>
        {reader.image ? <img src={reader.image} alt="" className="avatar" referrerPolicy="no-referrer" /> : null}
        <SignOutButton />
      </div>
    </header>
  );
}
