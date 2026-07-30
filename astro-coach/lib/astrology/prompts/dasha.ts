import type { NatalChart } from "@/lib/profile";

export function buildDashaPredictionPrompt(
  chart: NatalChart,
  dashaLord: string,
  years: number,
  todayIso?: string
): string {
  const { ascendant, planets } = chart;
  const dashaLordKey = dashaLord.toLowerCase() as keyof typeof planets;
  const dashaLordPlanet = planets[dashaLordKey];
  const moon = planets.moon;
  const todayNote = todayIso
    ? `\nToday's date: ${new Date(todayIso).toDateString()} — use this as the reference point for all timing language.`
    : "";

  // BUGFIX: this prompt previously also took an `antarLord` param, but the
  // only caller (DashaTimeline.tsx) always passed `antardashas[0].lord` —
  // which, by Vimshottari sequence construction, is ALWAYS identical to
  // `dashaLord` (a mahadasha's first antardasha is the same planet as the
  // mahadasha itself). So every single prediction request described one
  // placement twice and nothing else — at temperature 0.1, that thin,
  // duplicated signal made predictions for different charts converge toward
  // similar text whenever the dasha lord's sign/house happened to be close.
  // Fixed by dropping the redundant param and injecting genuinely
  // differentiating chart context instead: yogas/doshas actually tied to
  // this planet, and the Moon's own placement (Vimshottari timing is
  // Moon-nakshatra-derived, so it's always relevant to "why this period").
  const relevantYogas = (chart.yogas ?? []).filter((y) => y.planets.includes(dashaLordKey));
  const relevantDoshas = (chart.doshas ?? []).filter((d) => d.planets.includes(dashaLordKey));
  const combinationsNote = [...relevantYogas, ...relevantDoshas].length > 0
    ? `\n- Yogas/doshas involving ${dashaLord}: ${[...relevantYogas, ...relevantDoshas].map((c) => `${c.name} (${c.description})`).join("; ")}`
    : `\n- No specific yogas or doshas involve ${dashaLord} directly in this chart.`;

  return `You are a precise Vedic astrology expert specializing in Vimshottari Dasha interpretation.

Task: Provide a concise, practical prediction for this person's ${dashaLord} Maha Dasha, grounded specifically in THEIR chart below — not a generic description of what ${dashaLord} dashas mean in general. Two different people in a ${dashaLord} dasha should get noticeably different predictions if their charts differ.

Chart context:
- Ascendant: ${ascendant.sign}
- ${dashaLord} (the dasha lord) placement: ${dashaLordPlanet?.sign ?? "unknown"} House ${dashaLordPlanet?.house ?? "?"} ${dashaLordPlanet?.retrograde ? "(retrograde)" : ""} — Nakshatra: ${dashaLordPlanet?.nakshatra?.name ?? "unknown"}${combinationsNote}
- Moon (governs this dasha timing): ${moon?.sign ?? "unknown"} House ${moon?.house ?? "?"} — Nakshatra: ${moon?.nakshatra?.name ?? "unknown"}
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
- Reference the specific house, sign, or yoga/dosha above in at least half of the themes/actions — generic statements that could apply to any ${dashaLord} dasha regardless of chart are not acceptable.
- All strings must be practical and grounded (behavioral / life area language, not poetic or overly mystical).
- Use the current date as the reference for "now".
- Do not invent specific events or dates unless strongly indicated by the placements.`;
}
