/**
 * Wire format between /api/coach and ChatInterface. Kept in one place so the
 * server encoder and the client parser can't drift apart.
 *
 * Events (one JSON object per SSE `data:` line):
 *   { text }                 — a streamed delta, append it
 *   { replace }              — discard everything streamed so far, show this instead
 *                              (output guard rewrote or blocked the reply)
 *   { error }                — the turn failed; nothing here should be kept
 *   { done, outcome }        — final event; outcome says whether the turn counts
 */

export type CoachTurnOutcome = "ok" | "blocked" | "safety";

export type CoachStreamEvent =
  | { type: "text"; text: string }
  | { type: "replace"; text: string }
  | { type: "error"; error: string }
  | { type: "done"; outcome: CoachTurnOutcome };

export function encodeCoachEvent(event: CoachStreamEvent): string {
  switch (event.type) {
    case "text":
      return `data: ${JSON.stringify({ text: event.text })}\n\n`;
    case "replace":
      return `data: ${JSON.stringify({ replace: event.text })}\n\n`;
    case "error":
      return `data: ${JSON.stringify({ error: event.error })}\n\n`;
    case "done":
      return `data: ${JSON.stringify({ done: true, outcome: event.outcome })}\n\n`;
  }
}

function toEvent(data: string): CoachStreamEvent | null {
  if (data === "[DONE]") return { type: "done", outcome: "ok" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.error === "string") return { type: "error", error: p.error };
  if (typeof p.replace === "string") return { type: "replace", text: p.replace };
  if (typeof p.text === "string") return { type: "text", text: p.text };
  if (p.done === true) {
    const outcome = p.outcome === "blocked" || p.outcome === "safety" ? p.outcome : "ok";
    return { type: "done", outcome };
  }
  return null;
}

/**
 * Incremental SSE parser. Network reads can split a `data:` line anywhere
 * (including inside a multi-byte character), so bytes are decoded in stream
 * mode and only complete lines are parsed; the tail is carried to the next read.
 */
export function createCoachStreamParser() {
  const decoder = new TextDecoder();
  let buffer = "";

  function drain(final: boolean): CoachStreamEvent[] {
    const events: CoachStreamEvent[] = [];
    const lines = buffer.split("\n");
    buffer = final ? "" : (lines.pop() ?? "");
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      if (!line.startsWith("data: ")) continue;
      const event = toEvent(line.slice(6));
      if (event) events.push(event);
    }
    return events;
  }

  return {
    push(chunk: Uint8Array): CoachStreamEvent[] {
      buffer += decoder.decode(chunk, { stream: true });
      return drain(false);
    },
    end(): CoachStreamEvent[] {
      buffer += decoder.decode();
      return drain(true);
    },
  };
}
