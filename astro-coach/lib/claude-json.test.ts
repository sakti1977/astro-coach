import { describe, it, expect } from "vitest";
import { prepareJsonString, extractJsonObject, extractJsonArray } from "./claude-json";

describe("extractJsonObject", () => {
  it("parses a clean JSON object", () => {
    expect(extractJsonObject('{"a": 1, "b": "two"}')).toEqual({ a: 1, b: "two" });
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"a": 1}\n```';
    expect(extractJsonObject(raw)).toEqual({ a: 1 });
  });

  it("strips fences without a json language tag", () => {
    const raw = '```\n{"a": 1}\n```';
    expect(extractJsonObject(raw)).toEqual({ a: 1 });
  });

  it("ignores leading/trailing prose around the object", () => {
    const raw = 'Sure, here is the JSON:\n{"a": 1}\nLet me know if that helps!';
    expect(extractJsonObject(raw)).toEqual({ a: 1 });
  });

  it("escapes bare newlines inside string values", () => {
    const raw = '{"summary": "line one\nline two"}';
    expect(extractJsonObject(raw)).toEqual({ summary: "line one\nline two" });
  });

  it("parses pretty-printed, multi-line JSON without corrupting structural whitespace", () => {
    // Regression test: this is what Claude actually returns for most JSON-mode
    // prompts (fenced + indented), and it used to break prepareJsonString —
    // the newline/indentation between "{" and the first key was blindly
    // escaped into a literal backslash-n, which JSON.parse rejects right
    // after the opening brace.
    const raw = '```json\n{\n  "observations": [\n    {\n      "text": "avoids exam prep",\n      "category": "pattern"\n    }\n  ],\n  "shouldTransitionToRecommending": true\n}\n```';
    expect(extractJsonObject(raw)).toEqual({
      observations: [{ text: "avoids exam prep", category: "pattern" }],
      shouldTransitionToRecommending: true,
    });
  });

  it("still escapes a bare newline inside a string value within pretty-printed JSON", () => {
    const raw = '{\n  "summary": "line one\nline two",\n  "count": 2\n}';
    expect(extractJsonObject(raw)).toEqual({ summary: "line one\nline two", count: 2 });
  });

  it("does not mistake an escaped quote inside a string for the string's end", () => {
    const raw = '{\n  "text": "she said \\"hello\\" then left"\n}';
    expect(extractJsonObject(raw)).toEqual({ text: 'she said "hello" then left' });
  });

  it("escapes bare tabs and carriage returns inside string values", () => {
    const raw = '{"a": "col1\tcol2\rline2"}';
    expect(extractJsonObject(raw)).toEqual({ a: "col1\tcol2\rline2" });
  });

  it("strips stray control characters without corrupting the JSON", () => {
    const raw = '{"a": "value\x00with\x07control"}';
    expect(extractJsonObject(raw)).toEqual({ a: "value with control" });
  });

  it("throws a descriptive error when no object braces are present", () => {
    expect(() => extractJsonObject("no json here")).toThrow(/did not return a JSON object/);
  });

  it("KNOWN LIMITATION: breaks when trailing prose contains a '}' after the real closing brace", () => {
    // Documents the exact brittleness flagged in CODE_REVIEW.md: prepareJsonString finds
    // the closing brace via lastIndexOf("}") rather than brace-depth tracking. If any
    // text after the real JSON object also contains a '}', that later one wins, and the
    // slice includes the intervening prose as if it were part of the JSON — breaking the
    // parse. This test exists to make the limitation visible in CI, not to endorse it —
    // if this test starts failing because someone made the parser brace-depth aware,
    // delete it (that would mean the bug is fixed).
    const raw = '{"code": "if (x) { y() }"} trailing text with a stray }';
    expect(() => JSON.parse(prepareJsonString(raw))).toThrow();
  });
});

describe("extractJsonArray", () => {
  it("parses a clean JSON array", () => {
    expect(extractJsonArray("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("strips markdown code fences", () => {
    expect(extractJsonArray('```json\n[{"a": 1}]\n```')).toEqual([{ a: 1 }]);
  });

  it("throws a descriptive error when no array brackets are present", () => {
    expect(() => extractJsonArray("no json here")).toThrow(/did not return a JSON array/);
  });
});
