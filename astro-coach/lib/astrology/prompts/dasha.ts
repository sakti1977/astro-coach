import type { NatalChart } from "@/lib/profile";

export function buildDashaPredictionPrompt(
  chart: NatalChart,
  dashaLord: string,
  antarLord: string,
  years: number,
  todayIso?: string
): string {
  const { ascendant, planets } = chart;
  const dashaLordPlanet = planets[dashaLord.toLowerCase() as keyof typeof planets];
  const antarLordPlanet = planets[antarLord.toLowerCase() as keyof typeof planets];
  const todayNote = todayIso
    ? `\nToday's date: ${new Date(todayIso).toDateString()} — use this as the reference point for all timing language.`
    : "";

  return `You are a precise Vedic astrology expert specializing in Vimshottari Dasha interpretation.

Task: Provide a concise, practical prediction for the given dasha period in STRICT JSON format only.

Chart context:
- Ascendant: ${ascendant.sign}
- ${dashaLord} Maha Dasha lord placement: ${dashaLordPlanet?.sign ?? "unknown"} House ${dashaLordPlanet?.house ?? "?"} ${dashaLordPlanet?.retrograde ? "(retrograde)" : ""} ${dashaLordPlanet?.nakshatra.name ?? ""}
- ${antarLord} Antar Dasha lord placement: ${antarLordPlanet?.sign ?? "unknown"} House ${antarLordPlanet?.house ?? "?"}${antarLordPlanet?.retrograde ? " (retrograde)" : ""}
- Period length: ~${years} years${todayNote}

Output EXACTLY this JSON structure with no extra text, no markdown, no explanations before or after:

{
  "themes": ["3-4 short themes (under 12 words each)"],
  "cultivate": ["3-4 qualities or skills to develop (under 12 words each)"],
  "challenges": ["3-4 potential obstacles or tests (under 12 words each)"],
  "actions": ["3-4 concrete recommended actions (under 12 words each)"],
  "summary": "1-2 sentence neutral overview of the period's overall flavor."
}

Rules:
- All strings must be practical and grounded (behavioral / life area language, not poetic or overly mystical).
- Use the current date as the reference for "now".
- Do not invent specific events or dates unless strongly indicated by the placements.`;
}
