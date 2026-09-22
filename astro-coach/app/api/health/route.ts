import { NextRequest, NextResponse } from "next/server";
import { checkEphemerisHealth } from "@/lib/ephemeris";
import { HEALTH_RATE_LIMIT_MAX, HEALTH_RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
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
      // A cached 200 hides a dead ephemeris process. This route is the
      // liveness signal; it must describe the current check.
      headers: { "Cache-Control": "no-store" },
    }
  );
}
