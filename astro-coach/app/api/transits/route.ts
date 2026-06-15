import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchTransits } from "@/lib/ephemeris";

export async function POST(req: NextRequest) {
  if (process.env.NEXTAUTH_SECRET) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
