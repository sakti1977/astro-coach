import { describe, it, expect } from "vitest";
import { dignityPhrase } from "./dignityFraming";
import type { DignityTier } from "@/lib/profile";

const VERDICT_WORDS = /\b(good|bad)\b/i;

describe("dignityPhrase", () => {
  it("returns a non-fatalistic phrase for exalted", () => {
    const phrase = dignityPhrase("exalted");
    expect(phrase).toBe("operating from real strength");
    expect(phrase).not.toMatch(VERDICT_WORDS);
  });

  it("returns a non-fatalistic phrase for own sign", () => {
    const phrase = dignityPhrase("own");
    expect(phrase).toBe("in its own sign, a supportive period");
    expect(phrase).not.toMatch(VERDICT_WORDS);
  });

  it("returns a non-fatalistic phrase for debilitated, never asserting a fixed bad outcome", () => {
    const phrase = dignityPhrase("debilitated");
    expect(phrase).toBe("a period that may ask more deliberate effort");
    expect(phrase).not.toMatch(VERDICT_WORDS);
  });

  it("says nothing for neutral rather than forcing a flat label", () => {
    expect(dignityPhrase("neutral")).toBeNull();
  });

  it("says nothing for null/undefined", () => {
    expect(dignityPhrase(null)).toBeNull();
    expect(dignityPhrase(undefined)).toBeNull();
  });

  it("never returns good/bad verdict language for any tier", () => {
    const tiers: DignityTier[] = ["exalted", "own", "neutral", "debilitated"];
    for (const tier of tiers) {
      const phrase = dignityPhrase(tier);
      if (phrase) expect(phrase).not.toMatch(VERDICT_WORDS);
    }
  });
});
