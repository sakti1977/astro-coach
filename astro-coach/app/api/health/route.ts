import { NextResponse } from "next/server";
import { checkEphemerisHealth } from "@/lib/ephemeris";
import { HEALTH_CACHE_SECS } from "@/lib/constants";

export async function GET() {
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
