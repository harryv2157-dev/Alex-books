# Alex Books

A cosy reading tracker: a virtual bookshelf, page-by-page progress, voice or typed notes after each
reading session, and an end-of-book rating, review and AI-written look back at your thoughts.

Built with Next.js, Postgres and Google sign-in. Each Google account gets its own private shelf.

## Deploying on Railway

1. **Database** – add a PostgreSQL service to the project (done).
2. **Variables** on the `Alex-books` service:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres-R0yO.DATABASE_URL}}` (use "Add Reference" → your Postgres) |
   | `PORT` | `8080` |
   | `NEXTAUTH_SECRET` | any long random string |
   | `NEXTAUTH_URL` | the domain from step 3, e.g. `https://alex-books-production.up.railway.app` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud (below) |
   | `ANTHROPIC_API_KEY` | optional – turns on "Summarise my thoughts" |
   | `LOVE_NOTE_EMAIL` | optional – the one Google email that sees the private welcome note |
   | `LOVE_NOTE_EDITOR_EMAIL` | optional – the Google email that can edit that note at `/note` |
   | `BUDDY_READS_EMAILS` | optional – emails that can start buddy reads (hidden for everyone else) |
3. **Settings → Networking → Generate Domain**, port `8080`.
4. **Google sign-in** – in Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID
   (Web application). Authorised redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google`. While the OAuth
   consent screen is in "Testing", add each reader's Gmail address as a test user.

Tables are created automatically on first run.

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```
