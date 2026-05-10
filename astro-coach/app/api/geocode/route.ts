import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
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
