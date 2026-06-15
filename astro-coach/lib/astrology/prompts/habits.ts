import type { NatalChart } from "@/lib/profile";

export function buildHabitPrompt(
  chart: NatalChart,
  dashaLord: string,
  goals: string[],
  weakPlanets: string[],
  todayIso?: string
): string {
  const dashaLordPlanet = chart.planets[dashaLord.toLowerCase() as keyof typeof chart.planets];
  const todayNote = todayIso ? `Today's date: ${new Date(todayIso).toDateString()}\n` : "";

  return `You are a behavioral coach grounding habit recommendations in Vedic astrology.
${todayNote}
Current Dasha Lord: ${dashaLord} in ${dashaLordPlanet?.sign ?? "unknown"} (House ${dashaLordPlanet?.house ?? "?"})
User Goals: ${goals.length > 0 ? goals.join(", ") : "none set"}
Planets needing strengthening: ${weakPlanets.length > 0 ? weakPlanets.join(", ") : "none"}
Ascendant: ${chart.ascendant.sign}

Generate 8 specific, daily/weekly habits that:
1. Align with the ${dashaLord} Dasha energy (adopt its planetary qualities naturally through action)
2. Support the stated goals through concrete behavioral changes
3. Help balance/strengthen weak planets through lifestyle adjustments (not rituals)
4. Are measurable, actionable, and specific (not "be more mindful" but "meditate for 10 minutes each morning")
5. Consider the element and nature of planets (fire, earth, air, water; malefic, benefic)
6. Build on natural strengths shown in the chart
7. Address challenges shown by debilitated or afflicted planets
8. Create sustainable behavioral patterns aligned with the person's dharma

IMPORTANT: Return ONLY a raw JSON array with no markdown, no explanation, no code fences. The response must start with [ and end with ].

[{"habit": "...", "frequency": "daily|weekly", "planet": "sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu", "category": "physical|mental|social|creative|service", "why": "..."}]`;
}
