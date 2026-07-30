import { describe, it, expect } from "vitest";
import { buildDashaPredictionPrompt } from "./dasha";
import type { NatalChart } from "@/lib/profile";

// Regression guard: this prompt used to also take an `antarLord` param, but
// the only caller always passed `antardashas[0].lord`, which by Vimshottari
// construction is ALWAYS identical to `dashaLord`. Every prediction request
// therefore described one placement twice and nothing else — at
// temperature 0.1 (see lib/claude.ts), that thin duplicated signal made
// predictions for different charts converge toward similar text whenever
// the dasha lord's sign/house happened to be close. Reported by a user
// comparing predictions for two real charts.

function chart(overrides: Partial<NatalChart> = {}): NatalChart {
  return {
    ascendant: { sign: "Leo", sign_num: 4, degree: 12.5, abs_pos: 132.5 },
    planets: {
      saturn: { sign: "Capricorn", sign_num: 9, house: 6, degree: 8.0, abs_pos: 278.0, retrograde: false, nakshatra: { num: 22, name: "Shravana", pada: 2, lord: "Moon" } },
      moon: { sign: "Cancer", sign_num: 3, house: 12, degree: 5.0, abs_pos: 95.0, retrograde: false, nakshatra: { num: 7, name: "Pushya", pada: 1, lord: "Saturn" } },
    },
    moon_nakshatra: { num: 7, name: "Pushya", pada: 1, lord: "Saturn" },
    ...overrides,
  };
}

describe("buildDashaPredictionPrompt", () => {
  it("does not duplicate the dasha lord's placement as a separate 'antar dasha' line", () => {
    const prompt = buildDashaPredictionPrompt(chart(), "Saturn", 19);
    expect(prompt).not.toContain("Antar Dasha lord placement");
    // The placement should appear exactly once, not twice.
    const occurrences = (prompt.match(/Capricorn/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("always includes the Moon's own placement, since Vimshottari timing is Moon-derived", () => {
    const prompt = buildDashaPredictionPrompt(chart(), "Saturn", 19);
    expect(prompt).toContain("Moon (governs this dasha timing): Cancer House 12");
  });

  it("includes yogas/doshas tied to the specific dasha lord when present", () => {
    const withDosha = chart({
      doshas: [{ name: "Sade Sati", planets: ["saturn"], houses_involved: [], description: "Saturn transiting from natal Moon", strength: "challenging" }],
    });
    const prompt = buildDashaPredictionPrompt(withDosha, "Saturn", 19);
    expect(prompt).toContain("Sade Sati");
    expect(prompt).toContain("Saturn transiting from natal Moon");
  });

  it("says explicitly when no yoga/dosha involves this planet, rather than omitting the line silently", () => {
    const prompt = buildDashaPredictionPrompt(chart(), "Saturn", 19);
    expect(prompt).toContain("No specific yogas or doshas involve Saturn directly");
  });

  it("instructs the model that two different charts must produce noticeably different predictions", () => {
    const prompt = buildDashaPredictionPrompt(chart(), "Saturn", 19);
    expect(prompt).toContain("noticeably different predictions if their charts differ");
    expect(prompt).toContain("generic statements that could apply to any Saturn dasha");
  });

  it("injects a current-sub-period note when the Antardasha lord genuinely differs from the Maha lord", () => {
    const prompt = buildDashaPredictionPrompt(chart(), "Saturn", 19, undefined, {
      antarLord: "Moon",
      pratyantarLord: "Venus",
    });
    expect(prompt).toContain("CURRENTLY active period");
    expect(prompt).toContain("Moon");
    expect(prompt).toContain("Venus");
  });

  it("does NOT inject the current-sub-period note when the Antardasha lord equals the Maha lord (regression guard)", () => {
    // Protects against reintroducing the exact historical bug via this new
    // mechanism: never let a structurally-identical sub-period lord through.
    const prompt = buildDashaPredictionPrompt(chart(), "Saturn", 19, undefined, {
      antarLord: "Saturn",
      pratyantarLord: "Moon",
    });
    expect(prompt).not.toContain("CURRENTLY active period");
  });

  it("leaves the prompt unchanged when currentSubPeriod is omitted (no regression for past/future mahadasha predictions)", () => {
    const withParam = buildDashaPredictionPrompt(chart(), "Saturn", 19, undefined, undefined);
    const withoutParam = buildDashaPredictionPrompt(chart(), "Saturn", 19, undefined);
    expect(withParam).toBe(withoutParam);
  });

  it("produces meaningfully different prompts for two different charts sharing the same dasha lord", () => {
    const chartA = chart();
    const chartB = chart({
      planets: {
        saturn: { sign: "Aquarius", sign_num: 10, house: 2, degree: 20.0, abs_pos: 320.0, retrograde: true, nakshatra: { num: 24, name: "Shatabhisha", pada: 3, lord: "Rahu" } },
        moon: { sign: "Taurus", sign_num: 1, house: 3, degree: 15.0, abs_pos: 45.0, retrograde: false, nakshatra: { num: 4, name: "Rohini", pada: 2, lord: "Moon" } },
      },
    });
    const promptA = buildDashaPredictionPrompt(chartA, "Saturn", 19);
    const promptB = buildDashaPredictionPrompt(chartB, "Saturn", 19);
    expect(promptA).not.toBe(promptB);
    expect(promptA).toContain("Capricorn House 6");
    expect(promptB).toContain("Aquarius House 2 (retrograde)");
  });
});
