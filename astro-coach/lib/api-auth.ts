import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export interface ApiAccessContext {
  clientIp: string;
  rateLimitKey: string;
  session: Session | null;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")?.trim()
    ?? "unknown";
}

export async function getApiAccessContext(
  req: NextRequest
): Promise<ApiAccessContext | NextResponse> {
  const clientIp = getClientIp(req);

  if (!process.env.NEXTAUTH_SECRET) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Server authentication is not configured" },
        { status: 500 }
      );
    }

    return {
      clientIp,
      rateLimitKey: `ip:${clientIp}`,
      session: null,
    };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return {
    clientIp,
    rateLimitKey: `user:${session.user.id}`,
    session,
  };
}