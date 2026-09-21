"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function AuthProvider({ children }: { children: ReactNode }) {
  // Must wrap /auth/signin too: next-auth/react's signIn() refreshes the
  // client session via SessionProvider. Skipping it left __NEXTAUTH._getSession
  // as a no-op, so a successful credentials POST still looked signed-out.
  return <SessionProvider>{children}</SessionProvider>;
}
