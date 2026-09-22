import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";
import type { DashaData, NatalChart } from "@/lib/profile";

export const COACH_OUTPUT_FALLBACK =
  "I can only answer from your chart or from what you just told me. Ask again and I'll tie it to a specific placement.";

const FATALISTIC = [
  /\byou will (?:definitely |certainly )?(?:fail|die|divorce|lose your)\b/i,
  /\bthis marriage will not\b/i,
  /\b(?:guaranteed|destined|doomed) to (?:fail|end|divorce|die)\b/i,
  /\byou have no (?:choice|free will|way out)\b/i,
  /\bnothing you do can\b/i,
];

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
  if (FATALISTIC.some((pattern) => pattern.test(text))) {
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
