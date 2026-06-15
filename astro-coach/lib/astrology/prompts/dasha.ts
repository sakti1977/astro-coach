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

  return `Vedic astrology expert. Dasha prediction — raw JSON only, no markdown.${todayNote}

Chart: Ascendant ${ascendant.sign} | ${dashaLord}: ${dashaLordPlanet?.sign ?? "unknown"} H${dashaLordPlanet?.house ?? "?"} ${dashaLordPlanet?.retrograde ? "R" : ""} ${dashaLordPlanet?.nakshatra.name ?? ""} | ${antarLord}: ${antarLordPlanet?.sign ?? "unknown"} H${antarLordPlanet?.house ?? "?"}${antarLordPlanet?.retrograde ? " R" : ""}
Period: ${dashaLord} Maha / ${antarLord} Antar (~${years} yr)

Return this exact JSON (ALL 5 fields required, each array 3-4 items, strings under 15 words each):
{"themes":["...","...","..."],"cultivate":["...","...","..."],"challenges":["...","...","..."],"actions":["...","...","..."],"summary":"1-2 sentence overview."}`;
}
