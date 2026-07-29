import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { UserProfile, CoachingObservation } from "@/lib/profile";

// This route replaces direct browser -> Supabase writes/reads for user_profiles
// and coaching_observations. The browser's anon Supabase client is never signed
// in (NextAuth's Supabase sign-in happens server-side inside authorize()), so
// RLS's `auth.uid() = user_id` check always failed client-side — every sync
// silently no-op'd. Here the server verifies the NextAuth session first, then
// uses the service-role key (which bypasses RLS) scoped strictly to
// `access.session.user.id` — never to a client-supplied id.

interface SyncPushBody {
  profile: UserProfile;
  observations: CoachingObservation[];
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
    const { profile, observations } = (await req.json()) as SyncPushBody;

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

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Sync push error:", err);
    const msg = err instanceof Error ? err.message : "Sync failed";
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
    console.error("Sync pull error:", err);
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
