import { describe, it, expect, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";

// No UPSTASH_REDIS_REST_URL/TOKEN are set in the test env, so checkRateLimit
// always exercises the in-memory sliding-window fallback — the same path
// every local dev / single-instance deployment relies on.

describe("checkRateLimit (in-memory fallback)", () => {
  it("allows requests up to the limit and blocks the next one", async () => {
    const key = `test:${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit(key, 5, 60_000)).toBe(true);
    }
    expect(await checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it("tracks separate keys independently", async () => {
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) await checkRateLimit(keyA, 3, 60_000);
    expect(await checkRateLimit(keyA, 3, 60_000)).toBe(false);
    // keyB has never been used, so it should still be allowed.
    expect(await checkRateLimit(keyB, 3, 60_000)).toBe(true);
  });

  it("resets once the window elapses", async () => {
    vi.useFakeTimers();
    try {
      const key = `test:${crypto.randomUUID()}`;
      expect(await checkRateLimit(key, 1, 1_000)).toBe(true);
      expect(await checkRateLimit(key, 1, 1_000)).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(await checkRateLimit(key, 1, 1_000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
