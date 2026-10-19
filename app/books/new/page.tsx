import { requireReader } from "@/lib/auth";
import Header from "@/components/Header";
import AddBook from "@/components/AddBook";

export const dynamic = "force-dynamic";

export default async function NewBookPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const reader = await requireReader();
  return (
    <>
      <Header reader={reader} />
      <main className="page narrow">
        <h1 className="page-title">Add a book</h1>
        <AddBook initialQuery={q ?? ""} />
      </main>
    </>
  );
}
