import { describe, it, expect } from "vitest";
import { buildFoundationTask } from "./foundation";
import { buildCoachSystemPrompt } from "./coach";
import type { NatalChart, DashaData } from "@/lib/profile";

// NON_NEGOTIABLES.md #13 (no second, ungrounded advice pathway): "Your
// Foundation" must not become an independently-maintained analysis path. It
// reuses buildCoachSystemPrompt wholesale and only adds a task instruction —
// these tests check both the task instruction on its own, and that composing
// it with the real system prompt still carries the non-negotiable rules.

describe("buildFoundationTask", () => {
  const task = buildFoundationTask();

  it("is explicitly not a chat turn — no question, no waiting for a reply", () => {
    expect(task).toContain("NOT a chat turn");
    expect(task).toContain("Do not ask a question");
  });

  it("requires all five grounded sections, each tied to a specific chart element", () => {
    expect(task).toContain("CORE NATURE");
    expect(task).toContain("INNER WORLD");
    expect(task).toContain("WHAT'S ACTIVE RIGHT NOW");
    expect(task).toContain("NATURAL STRENGTHS");
    expect(task).toContain("WHERE THE FRICTION LIVES");
  });

  it("frames the friction section as a growth edge, never a fixed verdict (G3)", () => {
    expect(task).toMatch(/never a flaw or a fixed\s+verdict/);
  });

  it("requires the friction section to pair with an actual remedy, not an invented one", () => {
    expect(task).toMatch(/deterministic\s+remedy data already provided/);
    expect(task).toContain("not a generic suggestion invented for this piece");
  });

  it("holds itself to the same chain-analysis and writing-quality bar as coaching output", () => {
    expect(task).toContain("mandatory chain-analysis method");
    expect(task).toContain("writing-quality bar");
  });
});

describe("Foundation prompt composition (system + task)", () => {
  const CHART: NatalChart = {
    ascendant: { sign: "Leo", sign_num: 4, degree: 12.5, abs_pos: 132.5 },
    planets: {
      sun: { sign: "Leo", sign_num: 4, house: 1, degree: 10.0, abs_pos: 130.0, retrograde: false, nakshatra: { num: 10, name: "Magha", pada: 1, lord: "Ketu" } },
      moon: { sign: "Cancer", sign_num: 3, house: 12, degree: 5.0, abs_pos: 95.0, retrograde: false, nakshatra: { num: 7, name: "Pushya", pada: 1, lord: "Saturn" } },
    },
    moon_nakshatra: { num: 7, name: "Pushya", pada: 1, lord: "Saturn" },
  };
  const DASHAS: DashaData = {
    mahadashas: [
      { lord: "Saturn", years: 19, balance_years: 19, start: "2020-01-01", end: "2039-01-01", antardashas: [] },
    ],
    current_maha: "Saturn",
    current_antar: "Saturn",
    current_maha_end: "2039-01-01",
    current_antar_end: "2027-01-01",
  };

  it("the composed prompt still carries the deterministic-remedy and grounding rules from coach.ts", () => {
    const system = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z");
    const task = buildFoundationTask();
    const full = `${system}\n\n${task}`;
    expect(full).toContain("Never invent a remedy");
    expect(full).toContain("DEEP CHART SYNTHESIS — MANDATORY METHOD");
    expect(full).toContain("Ascendant (Lagna): Leo");
  });

  it("works identically regardless of tonePreference — same reuse, not a fork", () => {
    const jyotish = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z", true, [], [], "jyotish");
    const skeptic = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z", true, [], [], "skeptic");
    const task = buildFoundationTask();
    expect(`${jyotish}\n\n${task}`).toContain("NOT a chat turn");
    expect(`${skeptic}\n\n${task}`).toContain("NOT a chat turn");
  });
});
