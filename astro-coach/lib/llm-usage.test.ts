import { afterEach, describe, expect, it, vi } from "vitest";
import { MODEL_LIGHT, MODEL_PRIMARY } from "@/lib/constants";
import { createStreamUsageTracker, estimateCostUsd, recordLlmUsage } from "./llm-usage";

describe("estimateCostUsd", () => {
  it("prices every model the app is configured to call", () => {
    for (const model of [MODEL_PRIMARY, MODEL_LIGHT]) {
      expect(estimateCostUsd(model, { input_tokens: 1000, output_tokens: 1000 }), model).not.toBeNull();
    }
  });

  it("charges input and output at the model's own rates", () => {
    // Sonnet 5: $2 in / $10 out per million tokens.
    expect(estimateCostUsd(MODEL_PRIMARY, { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(12, 6);
    // Haiku 4.5: $1 in / $5 out per million tokens.
    expect(estimateCostUsd(MODEL_LIGHT, { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(6, 6);
  });

  it("discounts cache reads to 10% and surcharges cache writes to 125% of input", () => {
    expect(estimateCostUsd(MODEL_PRIMARY, { cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2, 6);
    expect(estimateCostUsd(MODEL_PRIMARY, { cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(2.5, 6);
  });

  it("treats null and missing counts as zero", () => {
    expect(estimateCostUsd(MODEL_PRIMARY, { input_tokens: null, cache_read_input_tokens: null })).toBe(0);
  });

  it("returns null, not $0, for a model with no price entry", () => {
    expect(estimateCostUsd("claude-some-future-model", { input_tokens: 1000 })).toBeNull();
  });
});

describe("recordLlmUsage", () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  afterEach(() => info.mockClear());

  it("writes one parseable line with counts and cost, and nothing else", () => {
    recordLlmUsage("coach", MODEL_PRIMARY, {
      input_tokens: 400, output_tokens: 600, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0,
    });
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0][0]);
    expect(line.startsWith("[llm-usage] ")).toBe(true);
    expect(JSON.parse(line.slice("[llm-usage] ".length))).toEqual({
      op: "coach", model: MODEL_PRIMARY, in: 400, out: 600, cacheRead: 5000, cacheWrite: 0, usd: 0.0078,
    });
  });

  it("logs an unpriced model with usd null so it is visible", () => {
    recordLlmUsage("coach", "claude-some-future-model", { input_tokens: 1, output_tokens: 1 });
    expect(String(info.mock.calls[0][0])).toContain('"usd":null');
  });

  it("never throws, even on missing or malformed usage", () => {
    expect(() => recordLlmUsage("coach", MODEL_PRIMARY, undefined)).not.toThrow();
    expect(() => recordLlmUsage("coach", MODEL_PRIMARY, { input_tokens: "x" as unknown as number })).not.toThrow();
    info.mockImplementation(() => { throw new Error("logger down"); });
    expect(() => recordLlmUsage("coach", MODEL_PRIMARY, { input_tokens: 1 })).not.toThrow();
    info.mockImplementation(() => {});
  });
});

describe("createStreamUsageTracker", () => {
  it("combines input/cache tokens from the start event with the running output total", () => {
    const tracker = createStreamUsageTracker();
    tracker.observe({
      type: "message_start",
      message: { usage: { input_tokens: 300, output_tokens: 1, cache_read_input_tokens: 4000, cache_creation_input_tokens: 0 } },
    });
    tracker.observe({ type: "content_block_delta" });
    tracker.observe({ type: "message_delta", usage: { output_tokens: 120 } });
    tracker.observe({ type: "message_delta", usage: { output_tokens: 410 } });
    expect(tracker.usage()).toEqual({
      input_tokens: 300, output_tokens: 410, cache_read_input_tokens: 4000, cache_creation_input_tokens: 0,
    });
  });

  it("still reports what it saw when the stream is stopped early", () => {
    const tracker = createStreamUsageTracker();
    tracker.observe({ type: "message_start", message: { usage: { input_tokens: 300, output_tokens: 1 } } });
    expect(tracker.usage()).toMatchObject({ input_tokens: 300, output_tokens: 1 });
  });
});
