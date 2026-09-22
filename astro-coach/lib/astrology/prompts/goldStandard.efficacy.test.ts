import { describe, it, expect } from "vitest";
import { buildCoachDynamicBlock, buildCoachSystemPrompt } from "./coach";
import { buildDashaPredictionPrompt } from "./dasha";
import type { DashaData, NatalChart } from "@/lib/profile";

/**
 * Gold natal: Mumbai 1990-06-15 08:30 IST, independently computed with
 * Swiss Ephemeris Lahiri (see python-service/gold_standard/natal_expected.json).
 * Efficacy tests check that coaching prompts actually ground in THIS chart
 * rather than generic sun-sign filler.
 */
const MUMBAI_1990: NatalChart = {
  ascendant: { sign: "Can", sign_num: 3, degree: 2.8341, abs_pos: 92.8341 },
  planets: {
    sun: { sign: "Gem", sign_num: 2, house: 12, degree: 0.0441, abs_pos: 60.0441, retrograde: false, nakshatra: { num: 4, name: "Mrigashirsha", pada: 3, lord: "Mars" } },
    moon: { sign: "Aqu", sign_num: 10, house: 8, degree: 16.6447, abs_pos: 316.6447, retrograde: false, nakshatra: { num: 23, name: "Shatabhisha", pada: 3, lord: "Rahu" } },
    mercury: { sign: "Tau", sign_num: 1, house: 11, degree: 11.3232, abs_pos: 41.3232, retrograde: false, nakshatra: { num: 3, name: "Rohini", pada: 1, lord: "Moon" } },
    venus: { sign: "Ari", sign_num: 0, house: 10, degree: 24.6094, abs_pos: 24.6094, retrograde: false, nakshatra: { num: 1, name: "Bharani", pada: 4, lord: "Venus" } },
    mars: { sign: "Pis", sign_num: 11, house: 9, degree: 17.0443, abs_pos: 347.0443, retrograde: false, nakshatra: { num: 26, name: "Revati", pada: 1, lord: "Mercury" } },
    jupiter: { sign: "Gem", sign_num: 2, house: 12, degree: 22.0809, abs_pos: 82.0809, retrograde: false, nakshatra: { num: 6, name: "Punarvasu", pada: 1, lord: "Jupiter" } },
    saturn: { sign: "Cap", sign_num: 9, house: 7, degree: 0.3266, abs_pos: 270.3266, retrograde: true, nakshatra: { num: 20, name: "Uttara Ashadha", pada: 2, lord: "Sun" } },
    rahu: { sign: "Cap", sign_num: 9, house: 7, degree: 14.3865, abs_pos: 284.3865, retrograde: false, nakshatra: { num: 21, name: "Shravana", pada: 2, lord: "Moon" } },
    ketu: { sign: "Can", sign_num: 3, house: 1, degree: 14.3865, abs_pos: 104.3865, retrograde: false, nakshatra: { num: 7, name: "Pushya", pada: 4, lord: "Saturn" } },
  },
  moon_nakshatra: { num: 23, name: "Shatabhisha", pada: 3, lord: "Rahu" },
  yogas: [
    {
      name: "Sasa",
      planets: ["saturn"],
      description: "Discipline, endurance, and mastery built through sustained effort.",
      strength: "strong",
    },
  ],
  doshas: [
    {
      name: "Manglik (Kuja) Dosha",
      planets: ["mars"],
      houses_involved: ["H9 from Lagna"],
      description: "Mars in a Kuja Dosha house — intensity in partnership timing.",
      strength: "moderate",
      remedies: [
        {
          planet: "mars",
          behavioral: "Give the assertive energy a physical outlet before it becomes reactive: a hard workout, a boxing bag, or a fixed daily physical practice, done before high-stakes conversations, not instead of them.",
          mantra: "Om Angarakaya Namah or the Hanuman Chalisa",
          gemstone: "Red Coral (Moonga)",
        },
      ],
    },
  ],
};

const DASHAS: DashaData = {
  mahadashas: [
    {
      lord: "Rahu",
      years: 18,
      balance_years: 4.5,
      start: "1990-06-15",
      end: "1995-01-01",
      antardashas: [
        { lord: "Rahu", years: 2.7, start: "1990-06-15", end: "1993-03-01" },
        { lord: "Jupiter", years: 2.4, start: "1993-03-01", end: "1995-01-01" },
      ],
    },
    {
      lord: "Jupiter",
      years: 16,
      balance_years: 16,
      start: "1995-01-01",
      end: "2011-01-01",
      antardashas: [],
    },
  ],
  current_maha: "Rahu",
  current_antar: "Jupiter",
  current_pratyantar: "Saturn",
  current_maha_end: "1995-01-01",
  current_antar_end: "1995-01-01",
  current_pratyantar_end: "1994-06-01",
};

const FATALISTIC_INSTRUCTIONS = [
  "you will fail",
  "this marriage will not work",
  "destiny cannot be changed",
];

describe("gold-standard coaching efficacy (Mumbai 1990 natal)", () => {
  it("grounds the system prompt in the gold chart's actual placements, not a sun-sign sketch", () => {
    const prompt = buildCoachSystemPrompt(MUMBAI_1990, DASHAS, "2026-09-20T00:00:00.000Z", true, MUMBAI_1990.yogas, MUMBAI_1990.doshas);
    expect(prompt).toContain("Ascendant (Lagna): Can at 2.8°");
    expect(prompt).toContain("Sun: Gem (House 12)");
    expect(prompt).toContain("Moon: Aqu (House 8)");
    expect(prompt).toContain("Shatabhisha");
    expect(prompt).toContain("Saturn: Cap (House 7)");
    expect(prompt).toContain("(R)"); // Saturn retrograde
    expect(prompt).toContain("Mars: Pis (House 9)");
    expect(prompt).not.toMatch(/Cancers are emotional/i);
    expect(prompt).toContain("Ground ALL advice in the user's actual chart");
  });

  it("names natal yogas and doshas that are present on this chart, with Manglik's behavioral remedy", () => {
    const prompt = buildCoachSystemPrompt(MUMBAI_1990, DASHAS, "2026-09-20T00:00:00.000Z", true, MUMBAI_1990.yogas, MUMBAI_1990.doshas);
    expect(prompt).toContain("Sasa");
    expect(prompt).toContain("Manglik (Kuja) Dosha");
    expect(prompt).toContain("physical outlet");
    expect(prompt).toContain("Om Angarakaya Namah");
    expect(prompt).not.toContain("Kaal Sarp");
    expect(prompt).not.toContain("Pitru Dosha");
  });

  it("behavioral-only mode still surfaces the Manglik sadhana and never requires ritual", () => {
    const prompt = buildCoachSystemPrompt(MUMBAI_1990, DASHAS, "2026-09-20T00:00:00.000Z", false, MUMBAI_1990.yogas, MUMBAI_1990.doshas);
    expect(prompt).toContain("sadhana — Give the assertive energy a physical outlet");
    expect(prompt).not.toContain("Om Angarakaya Namah");
    expect(prompt).toContain("Never suggest gemstones, mantras, fasting, or deity worship in this mode");
  });

  it("every coaching phase carries the anti-hallucination grounding rule (no second ungrounded path)", () => {
    for (const block of [
      buildCoachDynamicBlock("gathering", ["relationship"], undefined, "", undefined, false),
      buildCoachDynamicBlock("recommending", ["relationship"], undefined, "", undefined, false),
      buildCoachDynamicBlock("recommending", ["relationship"], undefined, "", undefined, true),
    ]) {
      expect(block).toContain("GROUNDING — NON-NEGOTIABLE");
      expect(block).toContain("Never invent a placement, remedy, timing, or life detail");
    }
  });

  it("forbids deterministic/fatalistic framing and requires purushartha", () => {
    const prompt = buildCoachSystemPrompt(MUMBAI_1990, DASHAS, "2026-09-20T00:00:00.000Z", true, MUMBAI_1990.yogas, MUMBAI_1990.doshas);
    expect(prompt.toLowerCase()).toContain("purushartha");
    expect(prompt).toContain("never a fixed verdict");
    for (const phrase of FATALISTIC_INSTRUCTIONS) {
      expect(prompt.toLowerCase()).not.toContain(phrase);
    }
  });

  it("skeptic tone still uses the same gold chart and chain-analysis method", () => {
    const skeptic = buildCoachSystemPrompt(MUMBAI_1990, DASHAS, "2026-09-20T00:00:00.000Z", true, MUMBAI_1990.yogas, MUMBAI_1990.doshas, "skeptic");
    expect(skeptic).toContain("DEEP CHART SYNTHESIS — MANDATORY METHOD");
    expect(skeptic).toContain("Ascendant (Lagna): Can at 2.8°");
    expect(skeptic).toContain("Manglik (Kuja) Dosha");
    expect(skeptic).toContain("do not skip or weaken the analysis itself");
  });

  it("dasha prediction prompt is chart-specific for this Saturn vs this Moon, not a generic Saturn mahadasha", () => {
    const prompt = buildDashaPredictionPrompt(MUMBAI_1990, "Saturn", 19, "2026-09-20T00:00:00.000Z");
    expect(prompt).toContain("Cap House 7");
    expect(prompt).toContain("Uttara Ashadha");
    expect(prompt).toContain("Moon (governs this dasha timing): Aqu House 8");
    expect(prompt).toContain("Shatabhisha");
    expect(prompt).toContain("Sasa");
    expect(prompt).not.toContain("Antar Dasha lord placement");
    const capHits = prompt.match(/Cap/g) ?? [];
    expect(capHits.length).toBeGreaterThanOrEqual(1);
  });

  it("recommending phase requires the four plan domains including BEHAVIOR as sadhana", () => {
    const block = buildCoachDynamicBlock("recommending", ["partnership"], undefined, "user mentioned conflict with spouse", undefined, false);
    expect(block).toContain("UPAYA");
    expect(block).toContain("BEHAVIOR");
    expect(block).toContain("Always include the behavioral sadhana");
    expect(block).toContain("Do NOT end with a new question");
  });
});
