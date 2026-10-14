import { currentReader } from "@/lib/auth";
import { listBooks } from "@/lib/books";
import Header from "@/components/Header";
import Bookshelf from "@/components/Bookshelf";
import SignInButton from "@/components/SignInButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const reader = await currentReader();
  if (!reader) {
    return (
      <main className="landing">
        <div className="landing-card">
          <h1>Alex Books</h1>
          <p>Your own little bookshelf. Log where you got to, jot down what you thought, and look back when you're done.</p>
          <SignInButton />
        </div>
      </main>
    );
  }

  const books = await listBooks(reader.id);
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
      </main>
    </>
  );
}
