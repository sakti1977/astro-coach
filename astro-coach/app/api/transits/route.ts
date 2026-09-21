import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { fetchTransits, ephemerisClientErrorMessage } from "@/lib/ephemeris";
import { checkRateLimit } from "@/lib/rate-limit";
import { loadStoredGrounding } from "@/lib/server-grounding";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  try {
    const body = await req.json() as {
      natal_asc_sign_num?: number;
      natal_moon_sign_num?: number;
      tz_str?: string;
    };

    let natalAsc = body.natal_asc_sign_num;
    let natalMoon = body.natal_moon_sign_num;
    const userId = access.session?.user?.id;
    if (userId) {
      const stored = await loadStoredGrounding(userId);
      if (stored?.chart) {
        natalAsc = stored.chart.ascendant.sign_num;
        natalMoon = stored.chart.planets.moon?.sign_num;
      }
    }

    if (natalAsc == null) {
      return NextResponse.json({ error: "natal_asc_sign_num required" }, { status: 400 });
    }
    const data = await fetchTransits({
      natal_asc_sign_num: natalAsc,
      natal_moon_sign_num: natalMoon,
      tz_str: body.tz_str,
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = ephemerisClientErrorMessage(err, "Transit fetch failed. Please try again shortly.");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
