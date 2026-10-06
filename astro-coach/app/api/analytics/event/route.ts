import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseAnalyticsEvent, isLikelyBot, utcDay } from "@/lib/analytics";

/**
 * Anonymous funnel beacon (lib/analytics.ts). Open to signed-out visitors by
 * design, so it is IP rate-limited and stores nothing about the caller: no IP,
 * user agent or account id. The write is server-side with the service-role
 * client (NON_NEGOTIABLES.md #1); the table has RLS on and no policies.
 *
 * Always answers 204 for well-formed requests, including bots and storage
 * failures, so analytics can never surface an error in the app.
 */
export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req, { allowAnonymous: true });
  if (access instanceof NextResponse) return access;
  if (!(await checkRateLimit(`analytics:${access.clientIp}`, 30, 60_000))) {
    return new NextResponse(null, { status: 429 });
  }

  const parsed = parseAnalyticsEvent(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (isLikelyBot(req.headers.get("user-agent")) || !supabaseAdmin) {
    return new NextResponse(null, { status: 204 });
  }

  const { event, visitorId, ref } = parsed.value;
  try {
    // One row per visitor, event and day; repeats are ignored.
    const { error } = await supabaseAdmin.from("analytics_events").upsert(
      { visitor_id: visitorId, event, day: utcDay(), ref },
      { onConflict: "visitor_id,event,day", ignoreDuplicates: true }
    );
    if (error) throw error;
  } catch (err: unknown) {
    console.error(`[analytics] ${err instanceof Error ? err.message : String(err)}`);
  }
  return new NextResponse(null, { status: 204 });
}
