import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ephemerisClientErrorMessage, fetchChart, fetchDashas } from "@/lib/ephemeris";
import { parseBirthData, parseDashaData, parseNatalChart } from "@/lib/profile-schema";
import type { DashaData, Goal, Habit, NatalChart } from "@/lib/profile";
import { diffCharts } from "@/lib/chart-integrity";

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
  /** IANA zone from the birth data, when known — used for transit timing. */
  timezone?: string;
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
      timezone: birth.timezone,
      source: "computed",
    };
  } catch (err: unknown) {
    const msg = ephemerisClientErrorMessage(err, "Chart calculation failed. Please try again shortly.");
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

/**
 * Where the coach's chart comes from when an account has stored birth data.
 *  - "stored":   trust the saved chart (the original behaviour; it was written by the browser).
 *  - "shadow":   still serve the saved chart, but recalculate in the background and log any
 *                disagreement. This is the default: it measures the problem without risking users.
 *  - "computed": serve a chart the ephemeris calculates from the saved birth data; fall back to
 *                the saved chart only if the ephemeris is unreachable.
 * Set with CHART_SOURCE_MODE.
 */
export type ChartSourceMode = "stored" | "shadow" | "computed";

export function chartSourceMode(): ChartSourceMode {
  const raw = process.env.CHART_SOURCE_MODE;
  return raw === "stored" || raw === "computed" ? raw : "shadow";
}

const COMPUTED_TTL_MS = 60 * 60 * 1000; // dasha "current_*" fields roll over with the date
const CACHE_MAX = 500;

type CachedChart = Pick<NatalGrounding, "chart" | "dashas" | "birthDate" | "timezone">;
const computedCache = new Map<string, { value: CachedChart; expires: number }>();

function birthKey(birth: BirthData): string {
  // The chart depends on when and where, not on the name.
  return [birth.date, birth.time, birth.lat, birth.lng, birth.timezone].join("|");
}

/** computeFromBirth, memoised per birth moment so shadow checks and repeat turns don't re-hit the ephemeris. */
async function computeFromBirthCached(
  birth: BirthData,
  goals: Goal[],
  habits: Habit[]
): Promise<NatalGrounding | NextResponse> {
  const key = birthKey(birth);
  const hit = computedCache.get(key);
  if (hit && hit.expires > Date.now()) {
    return { ...structuredClone(hit.value), goals, habits, source: "computed" };
  }
  const result = await computeFromBirth(birth, goals, habits);
  if (result instanceof NextResponse) return result;
  if (computedCache.size >= CACHE_MAX) computedCache.clear();
  computedCache.set(key, {
    value: structuredClone({
      chart: result.chart,
      dashas: result.dashas,
      birthDate: result.birthDate,
      timezone: result.timezone,
    }),
    expires: Date.now() + COMPUTED_TTL_MS,
  });
  return result;
}

const shadowChecked = new Set<string>();

/**
 * Fire-and-forget: compare the saved chart with a fresh calculation and log the
 * outcome. Never throws and never delays or alters the response. Logs carry
 * field paths only, no birth details or chart values.
 */
function scheduleShadowCheck(userId: string, stored: StoredGrounding): void {
  if (!stored.birth || !stored.chart || !stored.dashas) return;
  const checkKey = `${userId}|${stored.updatedAt ?? ""}|${birthKey(stored.birth)}`;
  if (shadowChecked.has(checkKey)) return;
  if (shadowChecked.size >= CACHE_MAX) shadowChecked.clear();
  shadowChecked.add(checkKey);

  const who = userId.slice(0, 8);
  const { chart, dashas, birth } = stored;
  void (async () => {
    const computed = await computeFromBirthCached(birth, [], []);
    if (computed instanceof NextResponse) {
      console.warn(`[chart-integrity] shadow check skipped user=${who} (calculation unavailable)`);
      return;
    }
    const diffs = diffCharts({ chart, dashas }, computed);
    if (diffs.length === 0) {
      console.info(`[chart-integrity] match user=${who}`);
    } else {
      console.warn(`[chart-integrity] MISMATCH user=${who} fields=${diffs.join(",")}`);
    }
  })().catch((err: unknown) => {
    console.warn(`[chart-integrity] shadow check failed user=${who}: ${err instanceof Error ? err.name : "error"}`);
  });
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
    const mode = chartSourceMode();

    if (mode === "computed" && stored?.birth) {
      const computed = await computeFromBirthCached(stored.birth, stored.goals, stored.habits);
      if (!(computed instanceof NextResponse)) return computed;
      if (!(stored.chart && stored.dashas)) return computed;
      console.warn(`[chart-integrity] calculation unavailable, serving saved chart user=${userId.slice(0, 8)}`);
    } else if (mode === "shadow" && stored) {
      scheduleShadowCheck(userId, stored);
    }

    if (stored?.chart && stored?.dashas) {
      return {
        chart: stored.chart,
        dashas: stored.dashas,
        goals: stored.goals,
        habits: stored.habits,
        birthDate: stored.birthDate,
        timezone: stored.birth?.timezone,
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
