import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { query } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/", error: "/" },
  logger: {
    error(code, metadata) {
      console.error("Auth error:", code, metadata);
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in: make sure the reader has a row, and remember their id.
      if (user?.email) {
        try {
          const [row] = await query<{ id: number }>(
            `INSERT INTO users (email, name, image) VALUES ($1, $2, $3)
             ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, image = EXCLUDED.image
             RETURNING id`,
            [user.email.toLowerCase(), user.name ?? null, user.image ?? null],
          );
          token.userId = row.id;
        } catch (err) {
          console.error("Sign-in: couldn't save the reader to the database", err);
          throw err;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.userId as number;
      return session;
    },
  },
};

export type Reader = { id: number; name: string | null; email: string; image: string | null };

export async function currentReader(): Promise<Reader | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id || !u.email) return null;
  return { id: u.id, name: u.name ?? null, email: u.email, image: u.image ?? null };
}

export async function requireReader(): Promise<Reader> {
  const reader = await currentReader();
  if (!reader) redirect("/");
  return reader;
}
