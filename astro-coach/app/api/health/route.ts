import { NextRequest, NextResponse } from "next/server";
import { checkEphemerisHealth } from "@/lib/ephemeris";
import { HEALTH_CACHE_SECS, HEALTH_RATE_LIMIT_MAX, HEALTH_RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const access = await getApiAccessContext(req, { allowAnonymous: true });
  if (access instanceof NextResponse) return access;
  if (!(await checkRateLimit(access.rateLimitKey, HEALTH_RATE_LIMIT_MAX, HEALTH_RATE_LIMIT_WINDOW_MS))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const ok = await checkEphemerisHealth();
  return NextResponse.json(
    { ok },
    {
      status: ok ? 200 : 503,
      // ARCH-01: allow CDN/browser to cache a healthy response for 60 s
      headers: ok ? { "Cache-Control": `public, max-age=${HEALTH_CACHE_SECS}` } : {},
    }
  );
}
