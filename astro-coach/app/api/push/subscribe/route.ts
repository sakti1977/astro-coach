import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isPushConfigured } from "@/lib/push";
import { safeClientErrorMessage } from "@/lib/safe-error";

interface SubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// POST: create/refresh a subscription for the signed-in user's browser.
export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;
  if (!access.session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin || !isPushConfigured()) {
    return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });
  }
  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  try {
    const { endpoint, keys } = (await req.json()) as SubscriptionBody;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: access.session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth_key: keys.auth,
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Subscribe failed. Please try again shortly.", "push-subscribe");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: fetch this browser's stored notification preferences, if subscribed.
export async function GET(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;
  if (!access.session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ subscribed: false });

  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "endpoint query param required" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("push_subscriptions")
    .select("notify_dasha, notify_sade_sati, notify_sadhana")
    .eq("endpoint", endpoint)
    .eq("user_id", access.session.user.id)
    .maybeSingle();

  if (!data) return NextResponse.json({ subscribed: false });
  return NextResponse.json({ subscribed: true, ...data });
}

// PATCH: update per-type notification preferences for this browser.
export async function PATCH(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;
  if (!access.session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });

  try {
    const { endpoint, notify_dasha, notify_sade_sati, notify_sadhana } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

    const updates: Record<string, boolean> = {};
    if (typeof notify_dasha === "boolean") updates.notify_dasha = notify_dasha;
    if (typeof notify_sade_sati === "boolean") updates.notify_sade_sati = notify_sade_sati;
    if (typeof notify_sadhana === "boolean") updates.notify_sadhana = notify_sadhana;

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .update(updates)
      .eq("endpoint", endpoint)
      .eq("user_id", access.session.user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Update failed. Please try again shortly.", "push-update");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: unsubscribe this browser.
export async function DELETE(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;
  if (!access.session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });

  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", access.session.user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Unsubscribe failed. Please try again shortly.", "push-unsubscribe");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
