import type { DignityTier, NatalChart } from "@/lib/profile";
import { SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";

/**
 * Deterministic chart facts the coach used to be asked to derive in its head
 * (lordship, dignity, conjunction, drishti, parivartana). Computing them here
 * removes a whole class of arithmetic hallucination: the model now cites
 * facts instead of inventing them.
 *
 * Dignity tables mirror python-service/yogas.py (_OWN/_EXALT) and
 * python-service/dignity.py exactly — exalted is checked before own sign, and
 * Rahu/Ketu are always neutral, because classical traditions disagree.
 */

const SEVEN: PlanetKey[] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"];
const ALL: PlanetKey[] = [...SEVEN, "rahu", "ketu"];

/** Sign ruler by sign index (0 = Aries). */
export const SIGN_LORD: PlanetKey[] = [
  "mars", "venus", "mercury", "moon", "sun", "mercury",
  "venus", "mars", "jupiter", "saturn", "saturn", "jupiter",
];

const OWN: Partial<Record<PlanetKey, number[]>> = {
  sun: [4], moon: [3], mars: [0, 7], mercury: [2, 5],
  jupiter: [8, 11], venus: [1, 6], saturn: [9, 10],
};

const EXALT: Partial<Record<PlanetKey, number>> = {
  sun: 0, moon: 1, mars: 9, mercury: 5, jupiter: 3, venus: 11, saturn: 6,
};

/** Special graha drishti, counted from the planet's own house (7th is universal). */
const SPECIAL_ASPECTS: Partial<Record<PlanetKey, number[]>> = {
  mars: [4, 8],
  jupiter: [5, 9],
  saturn: [3, 10],
};

const LABEL: Record<PlanetKey, string> = {
  sun: "Sun", moon: "Moon", mars: "Mars", mercury: "Mercury", jupiter: "Jupiter",
  venus: "Venus", saturn: "Saturn", rahu: "Rahu", ketu: "Ketu",
};

export function classifyDignity(planet: PlanetKey, signNum: number): DignityTier {
  if (EXALT[planet] === signNum) return "exalted";
  if (OWN[planet]?.includes(signNum)) return "own";
  const exalt = EXALT[planet];
  if (exalt !== undefined && (exalt + 6) % 12 === signNum) return "debilitated";
  return "neutral";
}

/** Houses (1-12, whole sign from the lagna) that a planet rules. */
export function housesRuled(planet: PlanetKey, ascSignNum: number): number[] {
  const houses: number[] = [];
  SIGN_LORD.forEach((lord, sign) => {
    if (lord === planet) houses.push(((sign - ascSignNum + 12) % 12) + 1);
  });
  return houses.sort((a, b) => a - b);
}

/** Houses a planet in `house` casts full drishti on. */
export function aspectedHouses(planet: PlanetKey, house: number): number[] {
  const offsets = [7, ...(SPECIAL_ASPECTS[planet] ?? [])];
  return offsets.map((n) => ((house - 1 + n - 1) % 12) + 1).sort((a, b) => a - b);
}

function present(chart: NatalChart): PlanetKey[] {
  return ALL.filter((k) => chart.planets[k]);
}

export function findParivartana(chart: NatalChart): Array<[PlanetKey, PlanetKey]> {
  const pairs: Array<[PlanetKey, PlanetKey]> = [];
  const planets = SEVEN.filter((k) => chart.planets[k]);
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      if (SIGN_LORD[chart.planets[a].sign_num] === b && SIGN_LORD[chart.planets[b].sign_num] === a) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

export function buildChartFactsBlock(chart: NatalChart): string {
  const asc = chart.ascendant.sign_num;
  const keys = present(chart);
  if (keys.length === 0) return "";

  const planetLines = keys.map((k) => {
    const p = chart.planets[k];
    const ruled = SEVEN.includes(k) ? housesRuled(k, asc) : [];
    const dignity = classifyDignity(k, p.sign_num);
    const aspects = aspectedHouses(k, p.house);
    const parts = [
      `${LABEL[k]} in ${SIGN_NAMES[p.sign_num]}, H${p.house}`,
      ruled.length ? `rules H${ruled.join(" & H")}` : "rules no sign (shadow planet)",
      dignity === "neutral" ? null : dignity,
      p.retrograde ? "retrograde" : null,
      `aspects H${aspects.join(", H")}`,
    ].filter(Boolean);
    return `- ${parts.join(" · ")}`;
  });

  const byHouse = new Map<number, PlanetKey[]>();
  for (const k of keys) {
    const h = chart.planets[k].house;
    byHouse.set(h, [...(byHouse.get(h) ?? []), k]);
  }
  const conjunctions = [...byHouse.entries()]
    .filter(([, ks]) => ks.length > 1)
    .sort(([a], [b]) => a - b)
    .map(([h, ks]) => `H${h}: ${ks.map((k) => LABEL[k]).join(" + ")}`);

  const exchanges = findParivartana(chart).map(([a, b]) => {
    const ha = chart.planets[a].house;
    const hb = chart.planets[b].house;
    return `${LABEL[a]} ↔ ${LABEL[b]} (fuses H${ha} and H${hb})`;
  });

  const lagnaLord = SIGN_LORD[asc];
  const lagnaLordPlanet = chart.planets[lagnaLord];

  return `CHART FACTS (computed, not interpreted — use these for STEP 2 lordship, STEP 4 parivartana and STEP 5 dignity; never contradict them):
- Lagna lord: ${LABEL[lagnaLord]}${lagnaLordPlanet ? ` in H${lagnaLordPlanet.house}` : ""}
${planetLines.join("\n")}
- Conjunctions (same house): ${conjunctions.length ? conjunctions.join("; ") : "none"}
- Parivartana (mutual sign exchange): ${exchanges.length ? exchanges.join("; ") : "none"}
Dignity here is exalted/own/debilitated only; anything unmarked is neutral in this table — do not claim friend/enemy sign dignity.`;
}

/** Divisional placements the coach is told to reference (D9, D10, D7, D30). */
export function buildVargaContext(chart: NatalChart): string {
  const vargas: Array<{ key: "d9_sign_num" | "d10_sign_num" | "d7_sign_num" | "d30_sign_num"; label: string }> = [
    { key: "d9_sign_num", label: "D9 Navamsa (relationship, inner nature)" },
    { key: "d10_sign_num", label: "D10 Dashamsha (career, public life)" },
    { key: "d7_sign_num", label: "D7 Saptamsha (children, creativity)" },
    { key: "d30_sign_num", label: "D30 Trimshamsha (nature of difficulties)" },
  ];

  const blocks: string[] = [];
  for (const { key, label } of vargas) {
    const ascSign = chart.ascendant[key];
    if (ascSign == null) continue;
    const placements = present(chart)
      .map((k) => {
        const sign = chart.planets[k][key];
        if (sign == null) return null;
        const house = ((sign - ascSign + 12) % 12) + 1;
        return `${LABEL[k]} ${SIGN_NAMES[sign]} (H${house})`;
      })
      .filter(Boolean);
    blocks.push(`${label}: Ascendant ${SIGN_NAMES[ascSign]}; ${placements.join(", ")}`);
  }
  return blocks.join("\n");
}
