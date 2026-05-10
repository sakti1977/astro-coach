import { NextRequest, NextResponse } from "next/server";
import { fetchTransits } from "@/lib/ephemeris";

export async function POST(req: NextRequest) {
  try {
    const { natal_asc_sign_num, tz_str } = await req.json();
    const transits = await fetchTransits({ natal_asc_sign_num, tz_str });
    return NextResponse.json(transits);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Transit fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
