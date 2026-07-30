import { describe, it, expect, vi } from "vitest";
import { runReflection, type ReflectInput } from "./route";
import { OBS_CAP, OBS_SUMMARISE_EVERY } from "@/lib/constants";
import type { CoachingObservation } from "@/lib/profile";

// This is the "new convention needed for orchestration logic" flagged in the
// multi-agent gap analysis: the extraction/summarisation agents are mocked
// via dependency injection (no live API calls, no module mocking) so the
// orchestrator's *decision logic* — merge, cap, conditional summarise,
// error surfacing — is exercised directly.

function baseInput(overrides: Partial<ReflectInput> = {}): ReflectInput {
  return {
    userMessage: "I keep procrastinating on my exam prep",
    assistantResponse: "Let's look at what's driving the delay.",
    exchangeCount: 1,
    existingObservations: [],
    ...overrides,
  };
}

function obs(text: string, category: CoachingObservation["category"] = "pattern", exchangeIndex = 0): CoachingObservation {
  return { id: `id-${text}`, timestamp: "2026-01-01T00:00:00.000Z", text, category, exchangeIndex };
}

const extractionJson = (observations: Array<{ text: string; category: string }>, shouldTransitionToRecommending: boolean) =>
  JSON.stringify({ observations, shouldTransitionToRecommending });

describe("runReflection", () => {
  it("merges new observations into the existing list and reports the transition decision, without summarising below the threshold", async () => {
    const extract = vi.fn().mockResolvedValue(
      extractionJson([{ text: "avoids exam prep when anxious", category: "pattern" }], true)
    );
    const summarise = vi.fn();

    const result = await runReflection(baseInput({ exchangeCount: 1, existingObservations: [obs("prior note")] }), {
      extract,
      summarise,
    });

    expect(summarise).not.toHaveBeenCalled();
    expect(result.summarised).toBe(false);
    expect(result.degraded).toBe(false);
    expect(result.shouldTransitionToRecommending).toBe(true);
    expect(result.finalObservations).toHaveLength(2);
    expect(result.finalObservations.map((o) => o.text)).toContain("avoids exam prep when anxious");
  });

  it("invokes the summarisation agent exactly at the OBS_SUMMARISE_EVERY boundary and adopts its output", async () => {
    const extract = vi.fn().mockResolvedValue(extractionJson([], false));
    const summarise = vi.fn().mockResolvedValue(
      JSON.stringify({ summaryObservations: [{ text: "consolidated: exam anxiety pattern", category: "pattern" }] })
    );

    const existing = Array.from({ length: 5 }, (_, i) => obs(`note ${i}`));
    const result = await runReflection(
      baseInput({ exchangeCount: OBS_SUMMARISE_EVERY, existingObservations: existing }),
      { extract, summarise }
    );

    expect(summarise).toHaveBeenCalledTimes(1);
    expect(result.summarised).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.finalObservations).toHaveLength(1);
    expect(result.finalObservations[0].text).toBe("consolidated: exam anxiety pattern");
  });

  it("does not summarise when the exchange count is a multiple of the threshold but there are no observations yet", async () => {
    const extract = vi.fn().mockResolvedValue(extractionJson([], false));
    const summarise = vi.fn();

    const result = await runReflection(
      baseInput({ exchangeCount: OBS_SUMMARISE_EVERY, existingObservations: [] }),
      { extract, summarise }
    );

    expect(summarise).not.toHaveBeenCalled();
    expect(result.summarised).toBe(false);
  });

  it("surfaces extraction failures as degraded instead of silently swallowing them, keeping prior observations intact", async () => {
    const extract = vi.fn().mockRejectedValue(new Error("upstream 500"));
    const summarise = vi.fn();

    const existing = [obs("prior note")];
    const result = await runReflection(baseInput({ existingObservations: existing }), { extract, summarise });

    expect(summarise).not.toHaveBeenCalled();
    expect(result.degraded).toBe(true);
    expect(result.error).toBeTruthy();
    expect(result.shouldTransitionToRecommending).toBe(false);
    expect(result.finalObservations).toEqual(existing);
  });

  it("surfaces summarisation failures as degraded, keeping the merged (pre-summary) observations", async () => {
    const extract = vi.fn().mockResolvedValue(extractionJson([{ text: "new note", category: "goal" }], false));
    const summarise = vi.fn().mockRejectedValue(new Error("upstream 500"));

    const existing = [obs("prior note")];
    const result = await runReflection(
      baseInput({ exchangeCount: OBS_SUMMARISE_EVERY, existingObservations: existing }),
      { extract, summarise }
    );

    expect(result.degraded).toBe(true);
    expect(result.summarised).toBe(false);
    expect(result.finalObservations.map((o) => o.text)).toEqual(["prior note", "new note"]);
  });

  it("trims the merged observation list to OBS_CAP, keeping the most recent entries", async () => {
    const extract = vi.fn().mockResolvedValue(
      extractionJson([{ text: "brand new", category: "goal" }], false)
    );
    const summarise = vi.fn();

    const existing = Array.from({ length: OBS_CAP }, (_, i) => obs(`note ${i}`));
    const result = await runReflection(baseInput({ existingObservations: existing }), { extract, summarise });

    expect(result.finalObservations).toHaveLength(OBS_CAP);
    expect(result.finalObservations[result.finalObservations.length - 1].text).toBe("brand new");
    expect(result.finalObservations[0].text).toBe("note 1"); // oldest entry dropped
  });

  it("drops malformed observations (invalid category) from the extraction agent's output rather than trusting them", async () => {
    const extract = vi.fn().mockResolvedValue(
      JSON.stringify({
        observations: [
          { text: "valid one", category: "goal" },
          { text: "invalid category", category: "not-a-real-category" },
          { text: "", category: "goal" },
        ],
        shouldTransitionToRecommending: false,
      })
    );
    const summarise = vi.fn();

    const result = await runReflection(baseInput(), { extract, summarise });

    expect(result.finalObservations).toHaveLength(1);
    expect(result.finalObservations[0].text).toBe("valid one");
  });
});
