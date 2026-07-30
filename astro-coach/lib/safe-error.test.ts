import { describe, it, expect, vi, afterEach } from "vitest";
import { safeClientErrorMessage } from "./safe-error";

// NON_NEGOTIABLES.md #5 regression guard, generalized: this is the shared
// helper every API route's catch block should use so upstream SDK error
// detail (Claude/Supabase/Sarvam/ephemeris) never reaches a production client.

describe("safeClientErrorMessage", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
  });

  it("returns the raw detail outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const err = new Error("relation \"coaching_observations\" does not exist");
    expect(safeClientErrorMessage(err, "generic fallback")).toBe(
      "relation \"coaching_observations\" does not exist"
    );
  });

  it("returns only the fallback in production, never upstream error detail", () => {
    vi.stubEnv("NODE_ENV", "production");
    const err = new Error("relation \"coaching_observations\" does not exist");
    const result = safeClientErrorMessage(err, "Sync failed. Please try again shortly.");
    expect(result).toBe("Sync failed. Please try again shortly.");
    expect(result).not.toContain("coaching_observations");
  });

  it("handles non-Error thrown values without leaking them in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(safeClientErrorMessage("raw string thrown", "fallback")).toBe("fallback");
  });
});
