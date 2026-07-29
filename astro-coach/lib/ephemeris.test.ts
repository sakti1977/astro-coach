import { describe, it, expect, vi, afterEach } from "vitest";
import { ephemerisClientErrorMessage } from "./ephemeris";

// This behavior is NON_NEGOTIABLES.md item #5 (no internal topology leaks):
// production must never echo internal error detail (service URLs, stack
// traces) to the client. This test is the regression guard for that fix.

describe("ephemerisClientErrorMessage", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
  });

  it("returns the raw detail outside production (useful for local dev)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const err = new Error("Cannot reach ephemeris service at http://localhost:8000.");
    expect(ephemerisClientErrorMessage(err, "generic fallback")).toBe(
      "Cannot reach ephemeris service at http://localhost:8000."
    );
  });

  it("returns only the generic fallback in production, never the internal detail", () => {
    vi.stubEnv("NODE_ENV", "production");
    const err = new Error("Cannot reach ephemeris service at http://internal-host:8000.");
    const result = ephemerisClientErrorMessage(err, "Chart calculation failed. Please try again shortly.");
    expect(result).toBe("Chart calculation failed. Please try again shortly.");
    expect(result).not.toContain("internal-host");
  });

  it("handles non-Error thrown values without leaking them in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const result = ephemerisClientErrorMessage("some raw string thrown", "fallback message");
    expect(result).toBe("fallback message");
  });
});
