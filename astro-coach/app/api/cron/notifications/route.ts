import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPush, isPushConfigured, type PushSubscriptionRow } from "@/lib/push";
import { fetchTransits } from "@/lib/ephemeris";
import { safeClientErrorMessage } from "@/lib/safe-error";
import type { DashaData, Habit, NatalChart } from "@/lib/profile";

// Runs once daily (Vercel Hobby plan allows only one cron invocation/day —
// see vercel.json). Scheduled for 02:30 UTC = 08:00 IST, tuned for this app's
// primary market. On Vercel Pro this could be split into per-timezone
// schedules for more precise local-morning delivery.
//
// Idempotency: every trigger type stores what it last notified about
// (last_dasha_notified_end / last_sade_sati_phase / last_sadhana_reminder_date)
// so a duplicate or re-run invocation never re-sends the same alert — required
// since Vercel cron delivery is best-effort and can occasionally double-fire.

const DASHA_LOOKAHEAD_HOURS = 36; // > 24h so a daily run can't ever skip a transition
const NONE_SENTINEL = "none";

interface ProfileRow {
  user_id: string;
  birth_data: { timezone?: string } | null;
  chart: NatalChart | null;
  dashas: DashaData | null;
  habits: Habit[] | null;
}

function todayUtcDateString(): string {
  return new Date().toISOString().split("T")[0];
}

interface FlatPeriod {
  antarLord: string;
  start: string;
  end: string;
}

function flattenAntardashas(dashas: DashaData): FlatPeriod[] {
  const flat: FlatPeriod[] = [];
  for (const maha of dashas.mahadashas) {
    for (const antar of maha.antardashas) {
      flat.push({ antarLord: antar.lord, start: antar.start, end: antar.end });
    }
  }
  return flat;
}

function findUpcomingTransition(dashas: DashaData): { ending: FlatPeriod; next: FlatPeriod | null } | null {
  const flat = flattenAntardashas(dashas);
  const now = Date.now();
  const windowMs = DASHA_LOOKAHEAD_HOURS * 3600 * 1000;
  const idx = flat.findIndex((p) => {
    const endMs = new Date(p.end).getTime();
    return endMs >= now && endMs <= now + windowMs;
  });
  if (idx === -1) return null;
  return { ending: flat[idx], next: flat[idx + 1] ?? null };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin || !isPushConfigured()) {
    return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });
  }

  const { data: subs, error: subsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*");
  if (subsError) {
    const msg = safeClientErrorMessage(subsError, "Failed to load subscriptions.", "cron-notifications");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  if (!subs || subs.length === 0) return NextResponse.json({ processed: 0, sent: 0 });

  const userIds = [...new Set(subs.map((s) => s.user_id as string))];
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id, birth_data, chart, dashas, habits")
    .in("user_id", userIds);
  if (profilesError) {
    const msg = safeClientErrorMessage(profilesError, "Failed to load profiles.", "cron-notifications");
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const profileByUser = new Map<string, ProfileRow>((profiles ?? []).map((p) => [p.user_id, p as ProfileRow]));
  const today = todayUtcDateString();
  let sent = 0;

  for (const sub of subs as (PushSubscriptionRow & {
    user_id: string;
    notify_dasha: boolean;
    notify_sade_sati: boolean;
    notify_sadhana: boolean;
    last_dasha_notified_end: string | null;
    last_sade_sati_phase: string | null;
    last_sadhana_reminder_date: string | null;
  })[]) {
    const profile = profileByUser.get(sub.user_id);
    if (!profile) continue;

    const updates: Record<string, string> = {};

    // ── Dasha / Antardasha transition ─────────────────────────────────────
    if (sub.notify_dasha && profile.dashas) {
      const transition = findUpcomingTransition(profile.dashas);
      if (transition && transition.ending.end !== sub.last_dasha_notified_end) {
        const body = transition.next
          ? `Your ${transition.ending.antarLord} Antardasha is ending — ${transition.next.antarLord} Antardasha begins next.`
          : `Your ${transition.ending.antarLord} Antardasha is ending soon.`;
        const ok = await sendPush(sub, { title: "A period is shifting", body, url: "/dasha" });
        if (ok) {
          sent++;
          updates.last_dasha_notified_end = transition.ending.end;
        }
      }
    }

    // ── Sade Sati phase change ────────────────────────────────────────────
    if (sub.notify_sade_sati && profile.chart) {
      try {
        const tzStr = profile.birth_data?.timezone ?? "UTC";
        const moonSignNum = profile.chart.planets.moon?.sign_num;
        const transits = await fetchTransits({
          natal_asc_sign_num: profile.chart.ascendant.sign_num,
          natal_moon_sign_num: moonSignNum,
          tz_str: tzStr,
        });
        const currentPhase: string = transits.sade_sati?.phase ?? NONE_SENTINEL;
        const lastPhase = sub.last_sade_sati_phase ?? NONE_SENTINEL;

        if (currentPhase !== lastPhase) {
          const body =
            currentPhase === NONE_SENTINEL
              ? "Your Sade Sati cycle has completed."
              : `Saturn has moved into the ${currentPhase} phase of your Sade Sati.`;
          const ok = await sendPush(sub, { title: "Sade Sati update", body, url: "/transits" });
          if (ok) {
            sent++;
            updates.last_sade_sati_phase = currentPhase;
          }
        }
      } catch {
        // Ephemeris service unreachable — skip this cycle, try again next run
      }
    }

    // ── Daily sadhana reminder ────────────────────────────────────────────
    if (sub.notify_sadhana && profile.habits && profile.habits.length > 0 && sub.last_sadhana_reminder_date !== today) {
      const anyDoneToday = profile.habits.some((h) => h.completedDates?.includes(today));
      if (!anyDoneToday) {
        const ok = await sendPush(sub, {
          title: "Today's sadhana is still open",
          body: "A few minutes now keeps the practice alive.",
          url: "/habits",
        });
        if (ok) {
          sent++;
          updates.last_sadhana_reminder_date = today;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from("push_subscriptions").update(updates).eq("id", sub.id);
    }
  }

  return NextResponse.json({ processed: subs.length, sent });
}
