"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button className="link-btn" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </button>
  );
}
