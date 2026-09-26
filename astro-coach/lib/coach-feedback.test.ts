import { describe, expect, it } from "vitest";
import { parseFeedback } from "./coach-feedback";

const base = { messageTimestamp: "2026-09-26T10:00:00.000Z", rating: "down", reply: "Your Saturn in H6…" };

describe("parseFeedback", () => {
  it("accepts a thumbs-down with a reason", () => {
    const r = parseFeedback({ ...base, reason: "too_generic" });
    expect(r.ok && r.value.reason).toBe("too_generic");
  });

  it("drops a reason attached to a thumbs-up", () => {
    const r = parseFeedback({ ...base, rating: "up", reason: "too_generic" });
    expect(r.ok && r.value.reason).toBeUndefined();
  });

  it("accepts null to clear a rating", () => {
    expect(parseFeedback({ ...base, rating: null }).ok).toBe(true);
  });

  it.each([
    { ...base, rating: "meh" },
    { ...base, reason: "rude" },
    { ...base, messageTimestamp: "yesterday" },
    { ...base, reply: "" },
    { ...base, reply: "x".repeat(20_000) },
  ])("rejects %o", (input) => {
    expect(parseFeedback(input).ok).toBe(false);
  });
});
