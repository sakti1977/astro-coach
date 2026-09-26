import { describe, expect, it } from "vitest";
import { CRISIS_RESPONSE, detectCrisis } from "./coach-safety";

describe("detectCrisis", () => {
  it.each([
    "I want to die",
    "honestly I've been thinking about suicide",
    "I don't want to live anymore",
    "sometimes I think about ending my life",
    "I've been cutting myself again",
    "mujhe marna chahta hoon",
  ])("flags %s", (text) => {
    expect(detectCrisis(text)).toBe(true);
  });

  it.each([
    "My deadline is killing me",
    "I want to end this job search",
    "What does Saturn in the 8th say about death of old patterns?",
  ])("does not flag %s", (text) => {
    expect(detectCrisis(text)).toBe(false);
  });

  it("points to a real helpline and emergency number, with no astrology", () => {
    expect(CRISIS_RESPONSE).toContain("14416");
    expect(CRISIS_RESPONSE).toContain("112");
    expect(CRISIS_RESPONSE).not.toMatch(/saturn|dasha|remedy|mantra/i);
  });
});
