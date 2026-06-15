import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { fetchTransits } from "@/lib/ephemeris";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  try {
    const { natal_asc_sign_num, tz_str } = await req.json();
    if (natal_asc_sign_num == null) {
      return NextResponse.json({ error: "natal_asc_sign_num required" }, { status: 400 });
    }
    const data = await fetchTransits({ natal_asc_sign_num, tz_str });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Transit fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
