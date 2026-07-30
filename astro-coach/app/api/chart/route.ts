import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { fetchChart, fetchDashas, checkEphemerisHealth, ephemerisClientErrorMessage } from "@/lib/ephemeris";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { name, year, month, day, hour, minute, lat, lng, tz_str } = body;

    if (!name || !year || !month || !day || lat == null || lng == null || !tz_str) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz_str });
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    // Fast health check before attempting full calculation
    const healthy = await checkEphemerisHealth();
    if (!healthy) {
      const devHint = "Ephemeris service is not running. Open a terminal and run:\n\ncd python-service && uvicorn main:app --port 8000";
      return NextResponse.json({
        error: process.env.NODE_ENV !== "production" ? devHint : "Chart calculation is temporarily unavailable. Please try again shortly.",
      }, { status: 503 });
    }

    const chart = await fetchChart({ name, year, month, day, hour: hour ?? 12, minute: minute ?? 0, lat, lng, tz_str });

    const planets = chart.planets as Record<string, { sign_num: number }>;
    const natal_planet_signs = Object.fromEntries(
      Object.entries(planets).map(([key, p]) => [key, p.sign_num])
    );

    const dashas = await fetchDashas({
      moon_abs_pos: chart.planets.moon.abs_pos,
      birth_year: year,
      birth_month: month,
      birth_day: day,
      natal_planet_signs,
    });

    return NextResponse.json({ chart, dashas });
  } catch (err: unknown) {
    const msg = ephemerisClientErrorMessage(err, "Chart calculation failed. Please try again shortly.");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
