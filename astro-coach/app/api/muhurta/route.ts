import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { fetchMuhurta, ephemerisClientErrorMessage } from "@/lib/ephemeris";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  try {
    const { year, month, day, lat, lng, tz_str, city } = await req.json();
    if (!year || !month || !day || lat == null || lng == null || !tz_str) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const data = await fetchMuhurta({ year, month, day, lat, lng, tz_str, city });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = ephemerisClientErrorMessage(err, "Muhurta calculation failed. Please try again shortly.");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
