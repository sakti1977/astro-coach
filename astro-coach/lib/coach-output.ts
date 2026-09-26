import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";
import type { DashaData, NatalChart } from "@/lib/profile";

export const COACH_OUTPUT_FALLBACK =
  "I can only answer from your chart or from what you just told me. Ask again and I'll tie it to a specific placement.";

const FATALISTIC = [
  /\byou will (?:definitely |certainly )?(?:fail|die|divorce|lose your)\b/i,
  /\bthis marriage will not\b/i,
  /\b(?:guaranteed|destined|doomed) to (?:fail|end|divorce|die)\b/i,
  /\byou have no (?:choice|free will|way out)\b/i,
  /\bnothing you do (?:can|will)\b/i,
  /\byou will never (?:marry|find (?:love|a partner|peace|success)|succeed|recover|be happy|get married|have children)\b/i,
  /\b(?:there is|there's) no hope\b/i,
  /\b(?:it is|it's) (?:your|written in your) (?:fate|destiny) (?:to|that)\b/i,
  /\bcannot be (?:changed|avoided|escaped)\b/i,
];

export function isFatalistic(text: string): boolean {
  return FATALISTIC.some((pattern) => pattern.test(text));
}

/** Appended to the dynamic block when a first draft fails the guard, so the
 * one retry knows exactly what to fix. */
export function coachRetryNote(reason: CoachOutputProblem): string {
  return reason === "fatalistic"
    ? "REWRITE REQUIRED: your previous draft asserted a fixed outcome. Rewrite the reply as tendencies the person can work with (purushartha), with no claim that anything is certain, doomed, or unchangeable."
    : "REWRITE REQUIRED: your previous draft did not tie its guidance to anything specific. Rewrite the reply so every point names the exact placement, dasha period, transit, or yoga/dosha from the chart data it comes from, or quotes what the user said.";
}

const USER_STOPWORDS = new Set([
  "about", "after", "again", "could", "should", "would", "there", "their", "which", "where", "while",
  "because", "really", "please", "thanks", "think", "going",
]);

export type CoachOutputProblem = "fatalistic" | "ungrounded";

function mentions(text: string, token: string): boolean {
  const cleaned = token.trim();
  if (cleaned.length < 3) return false;
  const pattern = new RegExp(`\\b${cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return pattern.test(text);
}

function chartTokens(chart: NatalChart, dashas: DashaData): string[] {
  const tokens = new Set<string>();
  const add = (value: string | undefined | null) => {
    if (value && value.trim().length >= 3) tokens.add(value.trim());
  };

  add(chart.ascendant.sign);
  add(SIGN_NAMES[chart.ascendant.sign_num]);
  add(chart.moon_nakshatra?.name);
  add(chart.moon_nakshatra?.lord);

  for (const [key, planet] of Object.entries(chart.planets)) {
    add(key);
    const meta = PLANET_META[key as PlanetKey];
    add(meta?.label);
    add(planet.sign);
    add(SIGN_NAMES[planet.sign_num]);
    add(planet.nakshatra?.name);
    add(planet.nakshatra?.lord);
  }

  add(dashas.current_maha);
  add(dashas.current_antar);
  add(dashas.current_pratyantar);
  for (const maha of dashas.mahadashas ?? []) add(maha.lord);
  for (const yoga of chart.yogas ?? []) add(yoga.name);
  for (const dosha of chart.doshas ?? []) add(dosha.name);

  return [...tokens];
}

function userTokens(userText: string): string[] {
  return (userText.toLowerCase().match(/[a-z][a-z'-]{4,}/g) ?? [])
    .filter((word) => !USER_STOPWORDS.has(word));
}

export function assessCoachOutput(
  text: string,
  chart: NatalChart,
  dashas: DashaData,
  userText: string
): { ok: true } | { ok: false; reason: CoachOutputProblem } {
  if (isFatalistic(text)) {
    return { ok: false, reason: "fatalistic" };
  }
  const grounded =
    chartTokens(chart, dashas).some((token) => mentions(text, token)) ||
    userTokens(userText).some((token) => mentions(text, token));
  if (!grounded) return { ok: false, reason: "ungrounded" };
  return { ok: true };
}

export function guardCoachText(
  text: string,
  chart: NatalChart,
  dashas: DashaData,
  userText: string
): string {
  const verdict = assessCoachOutput(text, chart, dashas, userText);
  if (verdict.ok) return text;
  console.error(`[coach-output] blocked ${verdict.reason}`);
  return COACH_OUTPUT_FALLBACK;
}
