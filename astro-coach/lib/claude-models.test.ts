import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Sonnet 5 400s on non-default temperature/top_p/top_k and thinks by default
// (thinking tokens count against max_tokens). Every call on the primary model
// must therefore state its thinking mode and never pass sampling params.
describe("Claude call settings", () => {
  const src = readFileSync(join(process.cwd(), "lib/claude.ts"), "utf8");
  const calls = src.split(/client\.messages\.(?:create|stream)\(/).slice(1).map((c) => c.slice(0, c.indexOf("messages:")));

  it("finds the calls", () => {
    expect(calls.length).toBeGreaterThanOrEqual(8);
  });

  it("primary-model calls set thinking explicitly and pass no sampling params", () => {
    const primary = calls.filter((c) => c.includes("MODEL_PRIMARY"));
    expect(primary.length).toBeGreaterThanOrEqual(5);
    for (const call of primary) {
      expect(call).toMatch(/thinking:/);
      expect(call).not.toMatch(/\b(?:temperature|top_p|top_k)\b/);
    }
  });

  it("no call hardcodes a model id", () => {
    expect(src).not.toMatch(/model:\s*["']claude-/);
  });
});
