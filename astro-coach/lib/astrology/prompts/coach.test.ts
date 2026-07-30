import { describe, it, expect } from "vitest";
import { buildCoachDynamicBlock, buildCoachSystemPrompt } from "./coach";
import type { NatalChart, DashaData } from "@/lib/profile";

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

// Regression coverage for the "endless questions, never concludes" fix:
// gathering must stay short, the first recommending turn must be a single
// conclusive plan that never asks a new question, and every mode must keep
// the anti-hallucination grounding rule.

describe("buildCoachDynamicBlock", () => {
  const goals = ["Get promoted"];

  it("gathering phase asks one question at a time and does not deliver a plan", () => {
    const block = buildCoachDynamicBlock("gathering", goals, undefined, "", undefined, false);
    expect(block).toContain("ASTROLOGICAL DISCOVERY");
    expect(block).toContain("NEVER ask more than ONE question");
    expect(block).not.toContain("DELIVER THE COMPLETE PLAN NOW");
  });

  it("gathering phase instructs a short discovery window, not an open-ended interview", () => {
    const block = buildCoachDynamicBlock("gathering", goals, undefined, "", undefined, false);
    expect(block).toMatch(/exchange 2/);
    expect(block.toLowerCase()).toContain("impatient");
  });

  it("first recommending turn (planDelivered=false) delivers one complete conclusive plan", () => {
    const block = buildCoachDynamicBlock("recommending", goals, undefined, "", undefined, false);
    expect(block).toContain("DELIVER THE COMPLETE PLAN NOW");
    expect(block).toContain("UPAYA");
    expect(block).toContain("LIFESTYLE");
    expect(block).toContain("BEHAVIOR");
    expect(block).toContain("THOUGHT PROCESS");
    expect(block).toContain("Do NOT end with a new question");
  });

  it("subsequent recommending turns (planDelivered=true) are follow-up only, no restated plan", () => {
    const block = buildCoachDynamicBlock("recommending", goals, undefined, "", undefined, true);
    expect(block).toContain("FOLLOW-UP ONLY");
    expect(block).toContain("Do not restate the whole plan");
    expect(block).not.toContain("DELIVER THE COMPLETE PLAN NOW");
  });

  it("every phase mode carries the anti-hallucination grounding rule", () => {
    const gathering = buildCoachDynamicBlock("gathering", goals, undefined, "", undefined, false);
    const firstPlan = buildCoachDynamicBlock("recommending", goals, undefined, "", undefined, false);
    const followUp = buildCoachDynamicBlock("recommending", goals, undefined, "", undefined, true);
    for (const block of [gathering, firstPlan, followUp]) {
      expect(block).toContain("Never invent a placement, remedy, timing, or life detail");
    }
  });

  it("still includes goals, varga context, and transit context in the output", () => {
    const block = buildCoachDynamicBlock(
      "gathering",
      ["Get promoted", "Save more"],
      "D9 Navamsa Ascendant: Leo (soul & relationship nature)",
      "",
      "CURRENT TRANSITS (Gochar — slow planets only):\n- Saturn in Capricorn → H3"
    );
    expect(block).toContain("Get promoted, Save more");
    expect(block).toContain("D9 Navamsa Ascendant");
    expect(block).toContain("CURRENT TRANSITS");
  });
});

// SPEC.md §3 — skeptic-friendly voice. Same chart data, same chain-analysis
// method, same deterministic remedy table; only the vocabulary layer differs.
describe("buildCoachSystemPrompt tonePreference", () => {
  it("defaults to the traditional Jyotish persona when tonePreference is omitted", () => {
    const prompt = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z");
    expect(prompt).toContain("You are a Jyotish practitioner");
    expect(prompt).not.toContain("VOICE OVERRIDE");
  });

  it("uses the plain-language persona and voice override in skeptic mode", () => {
    const prompt = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z", true, [], [], "skeptic");
    expect(prompt).not.toContain("You are a Jyotish practitioner");
    expect(prompt).toContain("precise behavioral coach");
    expect(prompt).toContain("VOICE OVERRIDE");
  });

  it("keeps the same chain-analysis method and chart grounding regardless of tone", () => {
    const jyotish = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z", true, [], [], "jyotish");
    const skeptic = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z", true, [], [], "skeptic");
    for (const prompt of [jyotish, skeptic]) {
      expect(prompt).toContain("DEEP CHART SYNTHESIS — MANDATORY METHOD");
      expect(prompt).toContain("Ascendant (Lagna): Leo");
      expect(prompt).toContain("Never invent a remedy");
    }
  });

  it("skeptic mode still instructs the model to use the same deterministic remedy data, not skip it", () => {
    const prompt = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z", true, [], [], "skeptic");
    expect(prompt).toContain("do not skip or weaken the analysis itself");
  });
});

// SPEC.md §2.6 — "world-class" per The Pattern's own reviews means writing
// quality, not just astrological correctness. This is a distinct calibration
// from the chain-analysis method: getting the placement logic right and then
// writing it up in generic astrology-app voice still fails the bar.
describe("buildCoachSystemPrompt writing-quality bar", () => {
  it("bans common generic-astrology-app hedging phrases", () => {
    const prompt = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z");
    expect(prompt).toContain("WRITING QUALITY");
    for (const crutch of ["you may find", "this could indicate", "it's important to", "on some level"]) {
      expect(prompt).toContain(crutch);
    }
  });

  it("gives a concrete generic-vs-specific example distinct from the chain-analysis example", () => {
    const prompt = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z");
    expect(prompt).toContain("Example of generic (WRONG)");
    expect(prompt).toContain("Example of specific (CORRECT)");
    // Distinct from the earlier chain-analysis shallow/deep example pair.
    expect(prompt).toContain("Example of shallow (WRONG)");
    expect(prompt).toContain("Example of deep (CORRECT)");
  });

  it("is present regardless of tonePreference — a prose-quality bar, not a jyotish-only concern", () => {
    const jyotish = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z", true, [], [], "jyotish");
    const skeptic = buildCoachSystemPrompt(CHART, DASHAS, "2026-07-30T00:00:00.000Z", true, [], [], "skeptic");
    for (const prompt of [jyotish, skeptic]) {
      expect(prompt).toContain("WRITING QUALITY — THIS IS THE PRODUCT");
    }
  });
});
