import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ephemerisClientErrorMessage, fetchChart, fetchDashas } from "@/lib/ephemeris";
import { parseBirthData, parseDashaData, parseNatalChart } from "@/lib/profile-schema";
import type { DashaData, Goal, Habit, NatalChart } from "@/lib/profile";

type BirthData = {
  name: string;
  date: string;
  time: string;
  lat: number;
  lng: number;
  timezone: string;
  city: string;
};

export interface StoredGrounding {
  chart: NatalChart | null;
  dashas: DashaData | null;
  goals: Goal[];
  habits: Habit[];
  birth: BirthData | null;
  birthDate?: string;
  updatedAt?: string;
}

export interface NatalGrounding {
  chart: NatalChart;
  dashas: DashaData;
  goals: Goal[];
  habits: Habit[];
  birthDate?: string;
  source: "server" | "computed";
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
  const birthParsed = parseBirthData(data.birth_data);
  return {
    chart: chartParsed.ok ? (chartParsed.value as NatalChart) : null,
    dashas: dashasParsed.ok ? (dashasParsed.value as DashaData) : null,
    goals: Array.isArray(data.goals) ? (data.goals as Goal[]) : [],
    habits: Array.isArray(data.habits) ? (data.habits as Habit[]) : [],
    birth: birthParsed.ok ? birthParsed.value : null,
    birthDate: birthParsed.ok ? birthParsed.value.date : undefined,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : undefined,
  };
}

/** Chart and dashas from birth data. Client-supplied longitudes are never used. */
async function computeFromBirth(
  birth: BirthData,
  goals: Goal[] = [],
  habits: Habit[] = []
): Promise<NatalGrounding | NextResponse> {
  const [year, month, day] = birth.date.split("-").map(Number);
  const [hour, minute] = birth.time.split(":").map(Number);
  if (![year, month, day, hour, minute].every((n) => Number.isInteger(n))) {
    return NextResponse.json({ error: "Birth date and time must be numeric." }, { status: 400 });
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: birth.timezone });
  } catch {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  try {
    const chartRaw = await fetchChart({
      name: birth.name,
      year, month, day, hour, minute,
      lat: birth.lat,
      lng: birth.lng,
      tz_str: birth.timezone,
    });
    const planets = chartRaw.planets as Record<string, { sign_num: number; abs_pos: number }>;
    const dashasRaw = await fetchDashas({
      moon_abs_pos: planets.moon.abs_pos,
      birth_year: year,
      birth_month: month,
      birth_day: day,
      natal_planet_signs: Object.fromEntries(
        Object.entries(planets).map(([key, planet]) => [key, planet.sign_num])
      ),
    });
    const chart = parseNatalChart(chartRaw);
    const dashas = parseDashaData(dashasRaw);
    if (!chart.ok || !dashas.ok) {
      return NextResponse.json(
        { error: "Chart calculation returned an unexpected shape." },
        { status: 500 }
      );
    }
    return {
      chart: chart.value as NatalChart,
      dashas: dashas.value as DashaData,
      goals,
      habits,
      birthDate: birth.date,
      source: "computed",
    };
  } catch (err: unknown) {
    const msg = ephemerisClientErrorMessage(err, "Chart calculation failed. Please try again shortly.");
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

/**
 * Prefer the stored natal chart. If that row has no chart yet, recompute
 * from birth data (the stored row, otherwise the request). Never trust
 * planet positions sent by the browser.
 */
export async function resolveNatalGrounding(
  userId: string | undefined,
  clientBirth: unknown
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
    if (stored?.birth) {
      return computeFromBirth(stored.birth, stored.goals, stored.habits);
    }
  }

  const birth = parseBirthData(clientBirth);
  if (!birth.ok) {
    return NextResponse.json(
      { error: "Birth data is required so the chart can be calculated on the server." },
      { status: 400 }
    );
  }
  return computeFromBirth(birth.value);
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
