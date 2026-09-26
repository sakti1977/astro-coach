import { describe, expect, it } from "vitest";
import { assessCoachOutput, COACH_OUTPUT_FALLBACK, guardCoachText } from "./coach-output";
import type { DashaData, NatalChart } from "./profile";

const moon = {
  sign: "Aqu",
  sign_num: 10,
  degree: 17.7,
  abs_pos: 317.7,
  house: 7,
  retrograde: false,
  nakshatra: { num: 23, name: "Shatabhisha", pada: 4, lord: "Rahu" },
};

const chart = {
  ascendant: { sign: "Leo", sign_num: 4, degree: 14, abs_pos: 134 },
  planets: { moon },
  moon_nakshatra: moon.nakshatra,
} as NatalChart;

const dashas = {
  mahadashas: [{ lord: "Rahu", years: 18, balance_years: 4, start: "2020-01-01", end: "2038-01-01", antardashas: [] }],
  current_maha: "Rahu",
  current_antar: "Moon",
  current_pratyantar: "Mars",
  current_maha_end: "2038-01-01",
  current_antar_end: "2027-01-01",
  current_pratyantar_end: "2026-06-01",
} as DashaData;

describe("assessCoachOutput", () => {
  it("accepts a reply that names a placement from this chart", () => {
    const verdict = assessCoachOutput(
      "Your Moon is in Aquarius, in the nakshatra Shatabhisha.",
      chart,
      dashas,
      "what is my moon sign?"
    );
    expect(verdict.ok).toBe(true);
  });

  it("accepts a reply that picks up what the user just said", () => {
    const verdict = assessCoachOutput(
      "The job search you described is the part to work with this week.",
      chart,
      dashas,
      "I have been stuck in a job search for months"
    );
    expect(verdict.ok).toBe(true);
  });

  it("rejects a generic sun-sign line that is not this chart", () => {
    const verdict = assessCoachOutput(
      "Cancers are emotional and need to trust their feelings.",
      chart,
      dashas,
      "hello"
    );
    expect(verdict).toEqual({ ok: false, reason: "ungrounded" });
  });

  it("rejects a fatalistic claim even when it names the chart", () => {
    const verdict = assessCoachOutput(
      "With Moon in Aquarius, this marriage will not work.",
      chart,
      dashas,
      "tell me about marriage"
    );
    expect(verdict).toEqual({ ok: false, reason: "fatalistic" });
  });

  it("replaces a blocked reply with a fallback that does not invent a fate", () => {
    const text = guardCoachText("You will fail at this.", chart, dashas, "help");
    expect(text).toBe(COACH_OUTPUT_FALLBACK);
    expect(assessCoachOutput(text, chart, dashas, "help").ok).toBe(false);
  });
});

describe("assessCoachOutput fatalism coverage", () => {
  it.each([
    "With Moon in Aquarius you will never marry.",
    "Moon in Aquarius means there is no hope for this.",
    "Moon in Aquarius: this cannot be changed.",
  ])("rejects %s", (text) => {
    expect(assessCoachOutput(text, chart, dashas, "marriage")).toEqual({ ok: false, reason: "fatalistic" });
  });

  it("does not flag agency language that happens to use 'never'", () => {
    const verdict = assessCoachOutput(
      "With Moon in Aquarius you will never have to force closeness; build it in small routines.",
      chart,
      dashas,
      "closeness"
    );
    expect(verdict.ok).toBe(true);
  });
});
