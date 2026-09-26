import { describe, expect, it } from "vitest";
import { jsonReplyText } from "@/lib/claude";
import { MAX_TOKENS_EXTRACT, MAX_TOKENS_SUMMARISE } from "@/lib/constants";

type Reply = Parameters<typeof jsonReplyText>[0];
const reply = (text: string, stop_reason: Reply["stop_reason"]) =>
  ({ content: [{ type: "text", text, citations: null }], stop_reason }) as Reply;

describe("jsonReplyText", () => {
  it("returns the text of a complete reply", () => {
    expect(jsonReplyText(reply('{"summaryObservations": []}', "end_turn"), "Summary")).toBe('{"summaryObservations": []}');
  });

  it("names truncation instead of handing back half a JSON document", () => {
    expect(() => jsonReplyText(reply('{"summaryObservations": [{"text": "Te', "max_tokens"), "Observation summary")).toThrow(
      /Observation summary reply truncated/
    );
  });

  it("rejects a non-text first block", () => {
    expect(() => jsonReplyText({ content: [], stop_reason: "end_turn" } as unknown as Reply, "x")).toThrow(/Unexpected/);
  });
});

// Production log: "Expected ',' or ']' after array element in JSON at position 1039"
// — 5-7 summary sentences in JSON did not fit in 250 tokens.
describe("observation token budgets", () => {
  it("leave room for the JSON the prompts ask for", () => {
    expect(MAX_TOKENS_SUMMARISE).toBeGreaterThanOrEqual(800);
    expect(MAX_TOKENS_EXTRACT).toBeGreaterThanOrEqual(600);
  });
});
