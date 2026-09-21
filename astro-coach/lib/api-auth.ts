import "@/lib/auth-env";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveAuthEnv } from "@/lib/auth-env";

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

export interface ApiAccessOptions {
  /** Allow a request through with an IP-keyed context instead of a 401 when
   * no session is present. Opt-in per route — default is unchanged (session
   * required). Only /api/chart uses this today (chart-only guest mode). */
  allowAnonymous?: boolean;
}

async function sessionFromRequest(req: NextRequest, secret: string | undefined): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session;
  if (!secret) return session ?? null;

  // getServerSession reads next/headers cookies(). Route handlers should also
  // accept the JWT on the incoming request — cookie prefix differs between
  // http (next-auth.session-token) and https/Vercel (__Secure-…).
  const token =
    (await getToken({ req, secret, secureCookie: false }))
    ?? (await getToken({ req, secret, secureCookie: true }));
  if (!token || typeof token.id !== "string") return null;

  const expires = typeof token.exp === "number"
    ? new Date(token.exp * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    user: {
      id: token.id,
      email: typeof token.email === "string" ? token.email : "",
      phone: typeof token.phone === "string" ? token.phone : "",
      name: typeof token.name === "string" ? token.name : null,
      image: null,
    },
    expires,
  };
}

export async function getApiAccessContext(
  req: NextRequest,
  opts: ApiAccessOptions = {}
): Promise<ApiAccessContext | NextResponse> {
  const clientIp = getClientIp(req);
  const { secret } = resolveAuthEnv();

  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Server authentication is not configured" },
      { status: 500 }
    );
  }

  const session = await sessionFromRequest(req, secret);
  if (!session?.user?.id) {
    if (opts.allowAnonymous || !secret) {
      return {
        clientIp,
        rateLimitKey: `ip:${clientIp}`,
        session: null,
      };
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return {
    clientIp,
    rateLimitKey: `user:${session.user.id}`,
    session,
  };
}
