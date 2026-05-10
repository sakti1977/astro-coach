import { NextRequest, NextResponse } from "next/server";
import { fetchChart, fetchDashas, checkEphemerisHealth } from "@/lib/ephemeris";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, year, month, day, hour, minute, lat, lng, tz_str } = body;

    if (!name || !year || !month || !day || lat == null || lng == null || !tz_str) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fast health check before attempting full calculation
    const healthy = await checkEphemerisHealth();
    if (!healthy) {
      return NextResponse.json({
        error: "Ephemeris service is not running. Open a terminal and run:\n\ncd python-service && uvicorn main:app --port 8000",
      }, { status: 503 });
    }

    const chart = await fetchChart({ name, year, month, day, hour: hour ?? 12, minute: minute ?? 0, lat, lng, tz_str });

    const dashas = await fetchDashas({
      moon_abs_pos: chart.planets.moon.abs_pos,
      birth_year: year,
      birth_month: month,
      birth_day: day,
    });

    return NextResponse.json({ chart, dashas });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Chart calculation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
