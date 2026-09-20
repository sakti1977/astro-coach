import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { parseSyncPushBody } from "@/lib/profile-schema";

// This route replaces direct browser -> Supabase writes/reads for user_profiles
// and coaching_observations. The browser's anon Supabase client is never signed
// in (NextAuth's Supabase sign-in happens server-side inside authorize()), so
// RLS's `auth.uid() = user_id` check always failed client-side — every sync
// silently no-op'd. Here the server verifies the NextAuth session first, then
// uses the service-role key (which bypasses RLS) scoped strictly to
// `access.session.user.id` — never to a client-supplied id.

function isNewer(serverIso: string | undefined, clientIso: string | undefined): boolean {
  if (!serverIso || !clientIso) return false;
  const server = Date.parse(serverIso);
  const client = Date.parse(clientIso);
  if (Number.isNaN(server) || Number.isNaN(client)) return false;
  return server > client + 2000;
}

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;
  if (!access.session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Cloud sync is not configured" }, { status: 503 });
  }
  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const userId = access.session.user.id;

  try {
    const parsed = parseSyncPushBody(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { profile, observations, force } = parsed.value;
    const localUpdatedAt =
      parsed.value.localUpdatedAt
      ?? (typeof profile.coaching?.lastUpdated === "string" ? profile.coaching.lastUpdated : undefined);

    const { data: existing } = await supabaseAdmin
      .from("user_profiles")
      .select("updated_at, chart")
      .eq("user_id", userId)
      .maybeSingle();

    if (
      !force
      && existing?.chart
      && isNewer(existing.updated_at as string | undefined, localUpdatedAt)
    ) {
      return NextResponse.json(
        {
          error: "Cloud copy is newer. Pull latest before pushing, or retry with force.",
          code: "SYNC_CONFLICT",
          serverUpdatedAt: existing.updated_at,
        },
        { status: 409 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({
        user_id: userId,
        birth_data: profile.birthData as unknown as Record<string, unknown>,
        chart: profile.chart as unknown as Record<string, unknown>,
        dashas: profile.dashas as unknown as Record<string, unknown>,
        validation: profile.validation as unknown as Record<string, unknown>,
        goals: profile.goals as unknown as Record<string, unknown>,
        habits: profile.habits as unknown as Record<string, unknown>,
        chat_history: profile.chatHistory as unknown as Record<string, unknown>,
        coaching: profile.coaching as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (profileError) throw profileError;

    // Only replace observations when the client actually sent the array.
    // An omitted field must not wipe cloud memory.
    if (observations) {
      await supabaseAdmin.from("coaching_observations").delete().eq("user_id", userId);

      if (observations.length > 0) {
        const { error: obsError } = await supabaseAdmin
          .from("coaching_observations")
          .insert(
            observations.map((obs) => ({
              user_id: userId,
              observation_id: obs.id,
              timestamp: obs.timestamp,
              text: obs.text,
              category: obs.category,
              exchange_index: obs.exchangeIndex,
            }))
          );
        if (obsError) throw obsError;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Sync failed. Please try again shortly.", "sync-push");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;
  if (!access.session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Cloud sync is not configured" }, { status: 503 });
  }
  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const userId = access.session.user.id;

  try {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError && profileError.code !== "PGRST116") throw profileError;

    const { data: obsData, error: obsError } = await supabaseAdmin
      .from("coaching_observations")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: true });

    if (obsError) throw obsError;

    return NextResponse.json({ profile: profileData ?? null, observations: obsData ?? [] });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Sync failed. Please try again shortly.", "sync-pull");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
