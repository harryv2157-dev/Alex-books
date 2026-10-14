import { currentReader } from "@/lib/auth";

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  first_publish_year?: number;
};

export type SearchResult = {
  key: string;
  title: string;
  author: string | null;
  pages: number | null;
  year: number | null;
  coverUrl: string | null;
};

export async function GET(req: Request) {
  if (!(await currentReader())) return Response.json({ results: [] }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });

  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "12");
  url.searchParams.set("fields", "key,title,author_name,number_of_pages_median,cover_i,first_publish_year");

  const res = await fetch(url, { headers: { "User-Agent": "AlexBooks/0.1 (personal reading tracker)" } });
  if (!res.ok) return Response.json({ results: [], error: "Book search is unavailable right now" }, { status: 502 });
  const data = (await res.json()) as { docs: OpenLibraryDoc[] };

  const results: SearchResult[] = data.docs.map((d) => ({
    key: d.key,
    title: d.title,
    author: d.author_name?.[0] ?? null,
    pages: d.number_of_pages_median ?? null,
    year: d.first_publish_year ?? null,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
  }));
  return Response.json({ results });
}
