import { describe, expect, it } from "vitest";
import { createCoachStreamParser, encodeCoachEvent, type CoachStreamEvent } from "./coach-stream";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("createCoachStreamParser", () => {
  it("reassembles an event split across network reads, including mid-character", () => {
    const wire = encodeCoachEvent({ type: "text", text: "Saturn in Cancer — मन" }) + encodeCoachEvent({ type: "done", outcome: "ok" });
    const all = bytes(wire);
    const parser = createCoachStreamParser();
    const events: CoachStreamEvent[] = [];
    // Feed one byte at a time: the worst possible chunking.
    for (let i = 0; i < all.length; i++) events.push(...parser.push(all.slice(i, i + 1)));
    events.push(...parser.end());
    expect(events).toEqual([
      { type: "text", text: "Saturn in Cancer — मन" },
      { type: "done", outcome: "ok" },
    ]);
  });

  it("surfaces server errors instead of dropping them", () => {
    const parser = createCoachStreamParser();
    const events = parser.push(bytes(encodeCoachEvent({ type: "error", error: "The coach hit a snag." })));
    expect(events).toEqual([{ type: "error", error: "The coach hit a snag." }]);
  });

  it("keeps replace and non-ok outcomes distinct", () => {
    const parser = createCoachStreamParser();
    const events = parser.push(
      bytes(encodeCoachEvent({ type: "replace", text: "fallback" }) + encodeCoachEvent({ type: "done", outcome: "blocked" }))
    );
    expect(events).toEqual([
      { type: "replace", text: "fallback" },
      { type: "done", outcome: "blocked" },
    ]);
  });

  it("ignores malformed lines without losing the good ones", () => {
    const parser = createCoachStreamParser();
    const events = parser.push(bytes(`data: {not json}\n\n: comment\n\n${encodeCoachEvent({ type: "text", text: "ok" })}`));
    expect(events).toEqual([{ type: "text", text: "ok" }]);
  });
});
