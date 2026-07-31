import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ANON_GEOCODE_RATE_LIMIT_MAX, ANON_GEOCODE_RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

// Required step before a guest can submit the chart form at all (place-of-
// birth search) — part of chart-only guest mode, same as /api/chart itself.
export async function GET(req: NextRequest) {
  const access = await getApiAccessContext(req, { allowAnonymous: true });
  if (access instanceof NextResponse) return access;

  const rateLimitOk = access.session
    ? await checkRateLimit(access.rateLimitKey)
    : await checkRateLimit(access.rateLimitKey, ANON_GEOCODE_RATE_LIMIT_MAX, ANON_GEOCODE_RATE_LIMIT_WINDOW_MS);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "AstroCoach/1.0 (personal-vedic-astrology-app)",
      "Accept-Language": "en",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
  }

  const raw: Array<{
    display_name: string;
    lat: string;
    lon: string;
    address: { city?: string; town?: string; village?: string; state?: string; country?: string; country_code?: string };
    type: string;
    importance: number;
  }> = await res.json();

  const results = raw.map((r) => {
    const addr = r.address;
    const locality = addr.city ?? addr.town ?? addr.village ?? "";
    const state = addr.state ?? "";
    const country = addr.country ?? "";
    const label = [locality, state, country].filter(Boolean).join(", ");

    return {
      label: label || r.display_name.split(",").slice(0, 3).join(","),
      display_name: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      country_code: addr.country_code?.toUpperCase() ?? "",
    };
  });

  return NextResponse.json({ results });
}
