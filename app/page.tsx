import { currentReader } from "@/lib/auth";
import { listBooks } from "@/lib/books";
import Header from "@/components/Header";
import Bookshelf from "@/components/Bookshelf";
import SignInButton from "@/components/SignInButton";
import Link from "next/link";
import LoveNote from "@/components/LoveNote";

export const dynamic = "force-dynamic";

const SIGN_IN_ERRORS: Record<string, string> = {
  AccessDenied: "That Google account isn't allowed to sign in yet.",
  Configuration: "Sign-in isn't set up correctly on the server.",
  OAuthCallback: "Google sign-in didn't complete. Please try again.",
  Callback: "Signed in with Google, but your shelf couldn't be opened. Please try again.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const reader = await currentReader();
  if (!reader) {
    return (
      <main className="landing">
        <div className="landing-card">
          <h1>Alex Books</h1>
          <p>Your own little bookshelf. Log where you got to, jot down what you thought, and look back when you're done.</p>
          {error ? (
            <p className="error">
              {SIGN_IN_ERRORS[error] ?? "Something went wrong signing in."} <span className="muted small">({error})</span>
            </p>
          ) : null}
          <SignInButton />
        </div>
      </main>
    );
  }

  const books = await listBooks(reader.id);
  // A private note for one reader only, chosen by the LOVE_NOTE_EMAIL setting on the server.
  const loveNoteEmail = process.env.LOVE_NOTE_EMAIL?.trim().toLowerCase();
  const showLoveNote = Boolean(loveNoteEmail) && reader.email.toLowerCase() === loveNoteEmail;
  const firstName = reader.name?.split(" ")[0];
  return (
    <>
      <Header reader={reader} />
      <main className="page">
        <h1 className="page-title">{firstName ? `${firstName}'s shelf` : "Your shelf"}</h1>
        {books.length === 0 ? (
          <div className="empty">
            <p>Your shelf is empty. Add the book you're reading now to get started.</p>
            <Link href="/books/new" className="btn btn-primary">
              Add your first book
            </Link>
          </div>
        ) : (
          <Bookshelf books={books} />
        )}
        {showLoveNote ? <LoveNote name={firstName ?? null} /> : null}
      </main>
    </>
  );
}
