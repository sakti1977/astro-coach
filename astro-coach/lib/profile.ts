"use client";

import { CHAT_HISTORY_MAX, MAX_ARCHIVES } from "@/lib/constants";

const PROFILE_KEY = "astro_coach_profile";

/** A single concrete remedy tied to one planet — deterministic, computed by the
 * ephemeris service from remedies.py's table, never improvised per-conversation.
 * `behavioral` is always present; the traditional fields are present whenever
 * the service was asked to include them (currently: always — the coaching
 * layer decides which fields to surface based on the user's own preference). */
export interface Remedy {
  planet: string;
  behavioral: string;
  deity?: string;
  mantra?: string;
  gemstone?: string;
  dana?: string;
  vrata_day?: string;
}

export interface Yoga {
  name: string;
  planets: string[];
  description: string;
  strength: "strong" | "moderate" | "challenging";
  remedies?: Remedy[];
}

/** A classical affliction (Manglik, Kaal Sarp, Pitru Dosha) detected in the
 * natal chart — kept distinct from Yoga because doshas are specifically what
 * remedial coaching targets. */
export interface Dosha {
  name: string;
  planets: string[];
  houses_involved: string[];
  description: string;
  strength: "moderate" | "challenging";
  remedies?: Remedy[];
}

/** Sade Sati — transit-dependent, so it lives on CachedTransits rather than
 * the natal chart's static doshas list. */
export interface SadeSati {
  name: "Sade Sati";
  phase: "first" | "peak" | "final";
  house_from_natal_moon: number;
  planets: string[];
  strength: "moderate" | "challenging";
  description: string;
  remedies?: Remedy[];
}

export interface PlanetData {
  sign: string;
  sign_num: number;
  degree: number;
  abs_pos: number;
  house: number;
  retrograde: boolean;
  nakshatra: { num: number; name: string; pada: number; lord: string };
  d9_sign_num?: number;
  d10_sign_num?: number;
  d7_sign_num?: number;
  d30_sign_num?: number;
}

// Minimal interface used by chart grid components — satisfied by NatalChart and varga charts
export interface ChartDisplay {
  ascendant: { sign: string; sign_num: number; degree: number; abs_pos: number };
  planets: Record<string, {
    sign: string; sign_num: number; house: number;
    degree: number; abs_pos: number; retrograde: boolean;
  }>;
}

export interface NatalChart extends ChartDisplay {
  ascendant: { sign: string; sign_num: number; degree: number; abs_pos: number; d9_sign_num?: number; d10_sign_num?: number; d7_sign_num?: number; d30_sign_num?: number };
  planets: Record<string, PlanetData>;
  moon_nakshatra: { num: number; name: string; pada: number; lord: string };
  yogas?: Yoga[];
  doshas?: Dosha[];
}

export interface DashaData {
  mahadashas: Array<{
    lord: string; years: number; balance_years: number;
    start: string; end: string;
    antardashas: Array<{
      lord: string; years: number; start: string; end: string;
      pratyantardashas?: Array<{ lord: string; years: number; start: string; end: string }>;
    }>;
  }>;
  current_maha: string;
  current_antar: string;
  current_maha_end: string;
  current_antar_end: string;
}

export interface ValidationEntry {
  question: string;
  answer: boolean;
  planet: string;
  house: number;
  theme: string;
}

export interface Goal {
  id: string;
  category: "career" | "health" | "relationship" | "finance" | "spiritual" | "creative";
  description: string;
  targetDate?: string;
  createdAt: string;
}

export interface Habit {
  id: string;
  habit: string;
  frequency: "daily" | "weekly";
  planet: string;
  category: string;
  why: string;
  completedDates: string[];
  streak: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  /** Canonical English text — always what's sent to Claude and stored/synced,
   * regardless of the user's chosen coaching language. */
  content: string;
  /** Localized text for display only (Sarvam-translated), when preferredLanguage
   * isn't English. Falls back to `content` when absent. */
  displayContent?: string;
  timestamp: string;
}

export type CoachingPhase = "gathering" | "recommending";

export interface CoachingObservation {
  id: string;
  timestamp: string;
  text: string;
  category: "behavior" | "emotion" | "pattern" | "goal" | "block";
  exchangeIndex: number;
}

/** Cached transit data with a timestamp for TTL checks (PERF-03). */
export interface CachedTransits {
  data: {
    planets: Record<string, {
      sign: string; sign_num: number; degree: number; abs_pos: number;
      house: number; retrograde: boolean; house_from_natal_lagna: number;
    }>;
    calculated_at: string;
    /** Computed server-side (single source of truth) — null when Saturn isn't
     * currently in a Sade Sati house from natal Moon. */
    sade_sati?: SadeSati | null;
  };
  cachedAt: string; // ISO timestamp of when we stored this
  tzStr?: string;
}

export interface UserProfile {
  birthData: {
    name: string; date: string; time: string;
    lat: number; lng: number; timezone: string; city: string;
  } | null;
  chart: NatalChart | null;
  dashas: DashaData | null;
  validation: {
    questions: ValidationEntry[];
    accuracyScore: number;
    confirmedThemes: string[];
    isValidated: boolean;
  };
  goals: Goal[];
  habits: Habit[];
  chatHistory: ChatMessage[];
  coaching: {
    behaviorProfile: string[];
    lastUpdated: string;
    phase: CoachingPhase;
    exchangeCount: number;
    includeReligiousSolutions: boolean;
    /** Sarvam BCP-47 language code (e.g. "hi-IN"). "en-IN" means English —
     * no translation layer is invoked. */
    preferredLanguage: string;
  };
  /** PERF-03: cached planetary transits with a 2-hour TTL. */
  cachedTransits?: CachedTransits;
}

const DEFAULT_PROFILE: UserProfile = {
  birthData: null,
  chart: null,
  dashas: null,
  validation: {
    questions: [],
    accuracyScore: 0,
    confirmedThemes: [],
    isValidated: false,
  },
  goals: [],
  habits: [],
  chatHistory: [],
  coaching: {
    behaviorProfile: [],
    lastUpdated: new Date().toISOString(),
    phase: "gathering" as CoachingPhase,
    exchangeCount: 0,
    // Vedic remedies (mantra/gemstone/dana alongside behavioral practice) are
    // the default — this app's premise is remedying astrological affliction
    // through Jyotish itself, not generic self-help with a chart attached.
    // Users who prefer behavioral-only guidance can turn this off in Coach.
    includeReligiousSolutions: true,
    preferredLanguage: "en-IN",
  },
};

export function getProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as UserProfile;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      coaching: { ...DEFAULT_PROFILE.coaching, ...parsed.coaching },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function updateProfile(updates: Partial<UserProfile>): UserProfile {
  const current = getProfile();
  const next = { ...current, ...updates };
  saveProfile(next);
  return next;
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROFILE_KEY);
}

/**
 * Save the current profile under a timestamped archive key before clearing.
 * Archives are stored as `astro_coach_profile_archive_{timestamp}` so they
 * do not interfere with the live profile key. Up to 5 archives are kept;
 * older ones are pruned to avoid filling localStorage.
 */
export function archiveProfile(): void {
  if (typeof window === "undefined") return;
  const profile = getProfile();
  if (!profile.chart) return; // nothing worth archiving

  const archiveKey = `${PROFILE_KEY}_archive_${Date.now()}`;
  try {
    localStorage.setItem(archiveKey, JSON.stringify(profile));
  } catch {
    // localStorage quota exceeded — skip archive silently
    return;
  }

  // Prune oldest archives so we keep at most 5
  const archiveKeys = Object.keys(localStorage)
    .filter((k) => k.startsWith(`${PROFILE_KEY}_archive_`))
    .sort(); // lexicographic sort is chronological for timestamp keys
  while (archiveKeys.length > MAX_ARCHIVES) {
    localStorage.removeItem(archiveKeys.shift()!);
  }
}

export function addChatMessage(message: ChatMessage): void {
  const profile = getProfile();
  const history = [...profile.chatHistory, message].slice(-CHAT_HISTORY_MAX);
  saveProfile({ ...profile, chatHistory: history });
}

export function addValidationAnswer(entry: ValidationEntry): number {
  const profile = getProfile();
  const questions = [...profile.validation.questions, entry];
  const yesCount = questions.filter((q) => q.answer).length;
  const score = questions.length > 0 ? yesCount / questions.length : 0;
  const confirmedThemes = questions
    .filter((q) => q.answer)
    .map((q) => q.theme)
    .filter((v, i, a) => a.indexOf(v) === i);

  saveProfile({
    ...profile,
    validation: { ...profile.validation, questions, accuracyScore: score, confirmedThemes },
  });
  return score;
}

export function buildCoachingContext(
  profile: UserProfile,
  observations: CoachingObservation[] = [],
  todayIso?: string
): string {
  const { validation, goals, coaching } = profile;
  const lines: string[] = [];

  // Always anchor with current date so Claude knows "now"
  const now = todayIso ? new Date(todayIso) : new Date();
  lines.push(`Current date: ${now.toDateString()} (${now.toISOString()})`);

  if (validation.confirmedThemes.length > 0)
    lines.push(`Confirmed life themes: ${validation.confirmedThemes.join(", ")}`);
  if (goals.length > 0)
    lines.push(`User goals: ${goals.map((g) => g.description).join(", ")}`);
  if (coaching.behaviorProfile.length > 0)
    lines.push(`Behavioral notes: ${coaching.behaviorProfile.join(". ")}`);
  lines.push(`Chart validation accuracy: ${Math.round(validation.accuracyScore * 100)}%`);
  if (observations.length > 0) {
    lines.push(
      `Session observations:\n${observations
        .map((o) => `  - [${o.category}] ${o.text}`)
        .join("\n")}`
    );
  }
  return lines.join("\n");
}
