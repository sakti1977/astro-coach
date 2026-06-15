"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    return <>{children}</>;
  }

  return <SessionProvider>{children}</SessionProvider>;
}
