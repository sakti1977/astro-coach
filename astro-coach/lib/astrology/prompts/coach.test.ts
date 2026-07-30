import { describe, it, expect } from "vitest";
import { buildCoachDynamicBlock } from "./coach";

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
