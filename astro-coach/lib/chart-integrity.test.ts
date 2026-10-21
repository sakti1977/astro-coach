import { describe, expect, it } from "vitest";
import type { DashaData, NatalChart } from "@/lib/profile";
import { diffCharts } from "./chart-integrity";

const moon = {
  sign: "Cancer", sign_num: 3, degree: 5, abs_pos: 95, house: 12, retrograde: false,
  nakshatra: { num: 7, name: "Pushya", pada: 1, lord: "Saturn" },
};

function make() {
  const chart = {
    ascendant: { sign: "Leo", sign_num: 4, degree: 12.5, abs_pos: 132.5 },
    planets: { moon, saturn: { ...moon, sign_num: 10, abs_pos: 280, house: 6, nakshatra: { ...moon.nakshatra, name: "Shravana" } } },
    moon_nakshatra: moon.nakshatra,
    yogas: [{ name: "Gajakesari" }],
    doshas: [],
  } as unknown as NatalChart;
  const dashas = {
    mahadashas: [{ lord: "Saturn", years: 19, start: "2020-01-01", end: "2039-01-01" }],
    current_maha: "Saturn", current_antar: "Saturn", current_maha_end: "2039-01-01", current_antar_end: "2027-01-01",
  } as unknown as DashaData;
  return { chart, dashas };
}

describe("diffCharts", () => {
  it("finds nothing when the charts agree", () => {
    expect(diffCharts(make(), make())).toEqual([]);
  });

  it("ignores sub-tolerance float noise and the date-dependent current dasha", () => {
    const stored = make();
    stored.chart.planets.moon.abs_pos += 0.001;
    stored.dashas.current_antar = "Mercury";
    expect(diffCharts(stored, make())).toEqual([]);
  });

  it("reports which fields differ, never their values", () => {
    const stored = make();
    stored.chart.ascendant.sign_num = 9;
    stored.chart.planets.saturn.house = 1;
    stored.chart.planets.saturn.nakshatra.name = "Pushya";
    expect(diffCharts(stored, make())).toEqual(["ascendant.sign_num", "planets.saturn.house", "planets.saturn.nakshatra"]);
  });

  it("catches a planet added or removed, edited yogas, and a shifted dasha sequence", () => {
    const stored = make();
    delete (stored.chart.planets as Record<string, unknown>).saturn;
    (stored.chart as unknown as { yogas: unknown[] }).yogas = [{ name: "Raja" }];
    stored.dashas.mahadashas[0].start = "2021-01-01";
    expect(diffCharts(stored, make())).toEqual(["planets.saturn.missing", "yogas", "dashas.mahadashas"]);
  });
});
