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

  return `You are a Vedic astrology expert. Generate a behavioral and life theme prediction for the following Dasha period.
CRITICAL: Return ONLY raw JSON. No apostrophes (use "do not" not "don't"), no special characters, no markdown.${todayNote}

Chart context:
- Ascendant: ${ascendant.sign}
- ${dashaLord} in chart: ${dashaLordPlanet?.sign ?? "unknown"}, House ${dashaLordPlanet?.house ?? "?"}, ${dashaLordPlanet?.retrograde ? "Retrograde" : "Direct"}, Nakshatra: ${dashaLordPlanet?.nakshatra.name ?? "unknown"}
- ${antarLord} in chart: ${antarLordPlanet?.sign ?? "unknown"}, House ${antarLordPlanet?.house ?? "?"}, ${antarLordPlanet?.retrograde ? "Retrograde" : "Direct"}

Dasha period: ${dashaLord} Maha Dasha / ${antarLord} Antardasha (next ~${years} years)

Generate predictions organized into these REQUIRED fields:

1. "themes": [array of 3-5 core life themes during this period - career, relationships, health, inner growth, spirituality]
2. "cultivate": [array of 3-5 behavioral qualities to cultivate based on ${dashaLord} and ${antarLord} nature]
3. "challenges": [array of 3-5 potential challenges, difficulties, or areas to watch out for based on planetary dignities and house positions]
4. "actions": [array of 3-5 specific action areas, life domains, or practical steps to take during this period]
5. "summary": "A 1-2 sentence overview of this period"

ALL FIVE FIELDS ARE REQUIRED. Each array must have at least 3 items.

Format as JSON: {"themes": [...], "cultivate": [...], "challenges": [...], "actions": [...], "summary": "..."}`;
}
