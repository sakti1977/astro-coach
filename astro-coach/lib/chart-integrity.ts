import type { DashaData, NatalChart } from "@/lib/profile";

/** Degrees; the ephemeris is deterministic, so this only absorbs float round-tripping through JSON. */
const POSITION_TOLERANCE = 0.01;

const MAX_REPORTED = 20;

function near(a: number | undefined, b: number | undefined): boolean {
  if (typeof a !== "number" || typeof b !== "number") return a === b;
  return Math.abs(a - b) <= POSITION_TOLERANCE;
}

function names(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => (item && typeof item === "object" ? (item as { name?: unknown }).name : undefined))
    .filter((name): name is string => typeof name === "string")
    .sort();
}

/**
 * Field paths where a stored (possibly browser-supplied) chart differs from one
 * the ephemeris just calculated for the same birth data. Paths only, never
 * values, so the result is safe to log. Empty means they agree.
 *
 * Dasha comparison covers the fixed mahadasha sequence; `current_*` fields move
 * with today's date and are deliberately left out.
 */
export function diffCharts(
  stored: { chart: NatalChart; dashas: DashaData },
  computed: { chart: NatalChart; dashas: DashaData }
): string[] {
  const diffs: string[] = [];
  const s = stored.chart;
  const c = computed.chart;

  if (s.ascendant.sign_num !== c.ascendant.sign_num) diffs.push("ascendant.sign_num");
  if (!near(s.ascendant.abs_pos, c.ascendant.abs_pos)) diffs.push("ascendant.abs_pos");

  const keys = new Set([...Object.keys(s.planets), ...Object.keys(c.planets)]);
  for (const key of [...keys].sort()) {
    const sp = s.planets[key];
    const cp = c.planets[key];
    if (!sp || !cp) {
      diffs.push(`planets.${key}.missing`);
      continue;
    }
    if (sp.sign_num !== cp.sign_num) diffs.push(`planets.${key}.sign_num`);
    if (!near(sp.abs_pos, cp.abs_pos)) diffs.push(`planets.${key}.abs_pos`);
    if (sp.house !== cp.house) diffs.push(`planets.${key}.house`);
    if (sp.retrograde !== cp.retrograde) diffs.push(`planets.${key}.retrograde`);
    if (sp.nakshatra?.name !== cp.nakshatra?.name) diffs.push(`planets.${key}.nakshatra`);
  }

  if (s.moon_nakshatra?.name !== c.moon_nakshatra?.name) diffs.push("moon_nakshatra");
  if (names((s as { yogas?: unknown }).yogas).join("|") !== names((c as { yogas?: unknown }).yogas).join("|")) {
    diffs.push("yogas");
  }
  if (names((s as { doshas?: unknown }).doshas).join("|") !== names((c as { doshas?: unknown }).doshas).join("|")) {
    diffs.push("doshas");
  }

  const sd = stored.dashas.mahadashas.map((m) => `${m.lord}@${m.start}`).join("|");
  const cd = computed.dashas.mahadashas.map((m) => `${m.lord}@${m.start}`).join("|");
  if (sd !== cd) diffs.push("dashas.mahadashas");

  return diffs.slice(0, MAX_REPORTED);
}
