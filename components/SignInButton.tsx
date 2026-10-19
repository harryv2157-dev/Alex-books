"use client";

import { signIn } from "next-auth/react";

export default function SignInButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  return (
    <button className="btn btn-primary btn-lg" onClick={() => signIn("google", { callbackUrl })}>
      Sign in with Google
    </button>
  );
}
