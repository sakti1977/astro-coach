import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseDashaData, parseNatalChart } from "@/lib/profile-schema";
import type { DashaData, Goal, Habit, NatalChart } from "@/lib/profile";

export interface StoredGrounding {
  chart: NatalChart | null;
  dashas: DashaData | null;
  goals: Goal[];
  habits: Habit[];
  birthDate?: string;
  updatedAt?: string;
}

export interface NatalGrounding {
  chart: NatalChart;
  dashas: DashaData;
  goals: Goal[];
  habits: Habit[];
  birthDate?: string;
  source: "server" | "client";
}

/**
 * Load natal + coaching trackers from the session-scoped row.
 * Service-role client is scoped to the verified NextAuth user id — never a
 * client-supplied id (NON_NEGOTIABLES.md #1).
 */
export async function loadStoredGrounding(userId: string): Promise<StoredGrounding | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("chart, dashas, goals, habits, birth_data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const chartParsed = parseNatalChart(data.chart);
  const dashasParsed = parseDashaData(data.dashas);
  return {
    chart: chartParsed.ok ? (chartParsed.value as NatalChart) : null,
    dashas: dashasParsed.ok ? (dashasParsed.value as DashaData) : null,
    goals: Array.isArray(data.goals) ? (data.goals as Goal[]) : [],
    habits: Array.isArray(data.habits) ? (data.habits as Habit[]) : [],
    birthDate:
      data.birth_data && typeof data.birth_data === "object" && "date" in data.birth_data
        ? String((data.birth_data as { date?: string }).date ?? "")
        : undefined,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : undefined,
  };
}

/**
 * Prefer the stored natal chart so LLM routes cannot be fed a forged chart
 * from the browser. If the account has no chart yet (guest just signed in,
 * sync still in flight), fall back to a schema-validated client payload.
 */
export async function resolveNatalGrounding(
  userId: string | undefined,
  clientChart: unknown,
  clientDashas: unknown
): Promise<NatalGrounding | NextResponse> {
  if (userId) {
    const stored = await loadStoredGrounding(userId);
    if (stored?.chart && stored?.dashas) {
      return {
        chart: stored.chart,
        dashas: stored.dashas,
        goals: stored.goals,
        habits: stored.habits,
        birthDate: stored.birthDate,
        source: "server",
      };
    }
  }

  const chart = parseNatalChart(clientChart);
  const dashas = parseDashaData(clientDashas);
  if (!chart.ok || !dashas.ok) {
    return NextResponse.json(
      { error: "A valid natal chart is required. Calculate your chart first, then try again." },
      { status: 400 }
    );
  }
  return {
    chart: chart.value as NatalChart,
    dashas: dashas.value as DashaData,
    goals: [],
    habits: [],
    source: "client",
  };
}

export function formatHabitsForCoach(habits: Habit[]): string {
  if (!habits.length) return "";
  return habits
    .map((h) => {
      const last = h.completedDates?.length
        ? h.completedDates[h.completedDates.length - 1]
        : "never";
      return `- ${h.habit} (${h.frequency}, ${h.planet}; streak ${h.streak ?? 0}; last done ${last})`;
    })
    .join("\n");
}
