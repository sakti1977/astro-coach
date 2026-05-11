"use client";

const PROFILE_KEY = "astro_coach_profile";

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
  ascendant: { sign: string; sign_num: number; degree: number; abs_pos: number; d9_sign_num?: number; d10_sign_num?: number; d7_sign_num?: number };
  planets: Record<string, PlanetData>;
  moon_nakshatra: { num: number; name: string; pada: number; lord: string };
}

export interface DashaData {
  mahadashas: Array<{
    lord: string; years: number; balance_years: number;
    start: string; end: string;
    antardashas: Array<{ lord: string; years: number; start: string; end: string }>;
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
  content: string;
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
  };
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

export function addChatMessage(message: ChatMessage): void {
  const profile = getProfile();
  const history = [...profile.chatHistory, message].slice(-100); // keep last 100
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

export function buildCoachingContext(profile: UserProfile, observations: CoachingObservation[] = []): string {
  const { validation, goals, coaching } = profile;
  const lines: string[] = [];
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
