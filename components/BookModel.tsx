"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { webglAvailable, type Book3DInput } from "@/lib/book3d";

const BookViewer3D = dynamic(() => import("./BookViewer3D"), { ssr: false });

// The book as a floating 3D model you can spin, falling back to the flat cover photo.
export default function BookModel({ book, owner }: { book: Book3DInput; owner?: string | null }) {
  const [three, setThree] = useState<boolean | null>(null);
  useEffect(() => {
    if (!webglAvailable()) return setThree(false);
    (document.fonts?.ready ?? Promise.resolve()).then(() => setThree(true));
  }, []);

  if (three) return <BookViewer3D book={book} owner={owner} className="book-model" />;
  if (three === false && book.has_cover) return <img src={`/api/cover/${book.id}`} alt="" className="cover-large" />;
  if (three === false) return <div className="cover-large cover-empty">{book.title}</div>;
  return <div className="book-model" />;
}
