import Link from "next/link";

export const metadata = { title: "Privacy · Alex Books" };

export default function PrivacyPage() {
  return (
    <main className="page narrow prose-page">
      <h1 className="page-title">Privacy</h1>
      <p>
        Alex Books is a small, private reading tracker for friends and family. This page explains what it stores and
        why.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Your name, email address and profile picture from Google, so you can sign in and have your own shelf.</li>
        <li>The books you add, cover photos you take, the pages you log, your notes, ratings and reviews.</li>
      </ul>
      <h2>How it's used</h2>
      <ul>
        <li>Your shelf and notes are only visible to you when signed in.</li>
        <li>
          If you tap &ldquo;Summarise my thoughts&rdquo;, that book&rsquo;s notes and review are sent to Anthropic&rsquo;s
          Claude API to write the summary. Nothing is sent unless you tap it.
        </li>
        <li>Book searches go to Open Library to find titles and covers.</li>
        <li>Voice notes are turned into text by your phone or browser; no audio is stored.</li>
        <li>Nothing is sold, shared for advertising, or used for anything else.</li>
      </ul>
      <h2>Deleting your data</h2>
      <p>
        You can delete any book (and all its notes) from the book&rsquo;s page. To have your whole account removed, ask
        the person who invited you and it will be deleted.
      </p>
      <p className="muted small">
        <Link href="/">Back to Alex Books</Link>
      </p>
    </main>
  );
}
