import { NextResponse } from "next/server";
import { checkEphemerisHealth } from "@/lib/ephemeris";

export async function GET() {
  const ok = await checkEphemerisHealth();
  return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
}
