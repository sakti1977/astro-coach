import { describe, expect, it } from "vitest";
import { aspectedHouses, buildChartFactsBlock, buildVargaContext, classifyDignity, findParivartana, housesRuled } from "./chartFacts";
import type { NatalChart, PlanetData } from "@/lib/profile";

function planet(sign_num: number, house: number, extra: Partial<PlanetData> = {}): PlanetData {
  return {
    sign: "", sign_num, degree: 10, abs_pos: sign_num * 30 + 10, house, retrograde: false,
    nakshatra: { num: 1, name: "Ashwini", pada: 1, lord: "Ketu" },
    ...extra,
  };
}

describe("chart facts", () => {
  it("derives lordship from a Sagittarius lagna (Saturn rules H2 and H3)", () => {
    expect(housesRuled("saturn", 8)).toEqual([2, 3]);
    expect(housesRuled("jupiter", 8)).toEqual([1, 4]);
  });

  it("classifies dignity the same way python-service/dignity.py does", () => {
    expect(classifyDignity("sun", 0)).toBe("exalted");
    expect(classifyDignity("sun", 6)).toBe("debilitated");
    expect(classifyDignity("mercury", 5)).toBe("exalted"); // exalted wins over own sign
    expect(classifyDignity("saturn", 10)).toBe("own");
    expect(classifyDignity("rahu", 1)).toBe("neutral");
  });

  it("counts special drishti from the planet's own house", () => {
    expect(aspectedHouses("saturn", 1)).toEqual([3, 7, 10]);
    expect(aspectedHouses("jupiter", 11)).toEqual([3, 5, 7]);
    expect(aspectedHouses("venus", 4)).toEqual([10]);
  });

  it("finds a mutual sign exchange", () => {
    const chart = {
      ascendant: { sign: "Aries", sign_num: 0, degree: 1, abs_pos: 1 },
      planets: { mars: planet(1, 2), venus: planet(0, 1) }, // Mars in Taurus, Venus in Aries
      moon_nakshatra: { num: 1, name: "Ashwini", pada: 1, lord: "Ketu" },
    } as NatalChart;
    expect(findParivartana(chart)).toEqual([["mars", "venus"]]);
    expect(buildChartFactsBlock(chart)).toContain("Mars ↔ Venus");
  });

  it("lists only the divisional charts that were actually computed", () => {
    const chart = {
      ascendant: { sign: "Aries", sign_num: 0, degree: 1, abs_pos: 1, d9_sign_num: 3, d30_sign_num: 9 },
      planets: { moon: planet(3, 4, { d9_sign_num: 6, d30_sign_num: 9 }) },
      moon_nakshatra: { num: 1, name: "Ashwini", pada: 1, lord: "Ketu" },
    } as NatalChart;
    const ctx = buildVargaContext(chart);
    expect(ctx).toContain("D9 Navamsa");
    expect(ctx).toContain("Moon Libra (H4)");
    expect(ctx).toContain("D30 Trimshamsha");
    expect(ctx).not.toContain("D10");
  });
});
