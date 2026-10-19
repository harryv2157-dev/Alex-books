import { requireReader } from "@/lib/auth";
import Header from "@/components/Header";
import NextReads from "@/components/NextReads";

export const dynamic = "force-dynamic";

export default async function NextPage() {
  const reader = await requireReader();
  return (
    <>
      <Header reader={reader} />
      <main className="page narrow">
        <h1 className="page-title">What to read next</h1>
        <p className="muted">Picked from what you rated highly and what you wrote in your reviews and notes.</p>
        <NextReads />
      </main>
    </>
  );
}
