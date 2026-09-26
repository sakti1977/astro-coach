import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { streamCoachResponse } from "@/lib/claude";
import { buildCoachSystemPrompt, buildCoachDynamicBlock } from "@/lib/astrology/prompts";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { formatHabitsForCoach, resolveNatalGrounding } from "@/lib/server-grounding";
import { assessCoachOutput, coachRetryNote, COACH_OUTPUT_FALLBACK, isFatalistic } from "@/lib/coach-output";
import { parseCoachRequest } from "@/lib/coach-request";
import { encodeCoachEvent, type CoachStreamEvent } from "@/lib/coach-stream";
import { CRISIS_RESPONSE, detectCrisis } from "@/lib/coach-safety";
import { serverTransitContext } from "@/lib/coach-transits";
import { COACH_DAILY_TURN_MAX, COACH_DAILY_WINDOW_MS } from "@/lib/constants";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

function sse(events: CoachStreamEvent[]): Response {
  const body = events.map(encodeCoachEvent).join("");
  return new Response(body, { headers: SSE_HEADERS });
}

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }
  // Separate key: the local fallback limiter stores one counter per key.
  if (!(await checkRateLimit(`${access.rateLimitKey}:coach-day`, COACH_DAILY_TURN_MAX, COACH_DAILY_WINDOW_MS))) {
    return NextResponse.json(
      { error: "You've reached today's coaching limit. It resets within 24 hours." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid coaching request." }, { status: 400 });
  }
  const parsed = parseCoachRequest(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.value;
  const messages = body.messages;
  const latestUser = messages[messages.length - 1].content;

  // Safety first: a crisis message gets people, not a chart reading, and
  // does not need the chart at all.
  if (detectCrisis(latestUser)) {
    return sse([
      { type: "text", text: CRISIS_RESPONSE },
      { type: "done", outcome: "safety" },
    ]);
  }

  const grounding = await resolveNatalGrounding(access.session?.user?.id, body.birthData);
  if (grounding instanceof NextResponse) return grounding;

  const goals =
    grounding.source === "server"
      ? grounding.goals.map((g) => g.description)
      : (body.goals ?? []);
  const habitsSummary = formatHabitsForCoach(
    grounding.source === "server" ? grounding.habits : body.habits
  );
  const transitContext = await serverTransitContext(grounding.chart, grounding.timezone);

  const systemPrompt = buildCoachSystemPrompt(
    grounding.chart,
    grounding.dashas,
    new Date().toISOString(),
    body.includeReligiousSolutions ?? false,
    grounding.chart.yogas ?? [],
    grounding.chart.doshas ?? [],
    body.tonePreference ?? "jyotish"
  );

  const planDelivered = body.planDelivered ?? false;
  const dynamicBlock = buildCoachDynamicBlock(
    body.phase ?? "gathering",
    goals,
    undefined,
    body.profileContext ?? "",
    transitContext || undefined,
    planDelivered,
    habitsSummary,
    planDelivered ? body.deliveredPlan : undefined
  );

  const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const signal = req.signal;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: CoachStreamEvent) => controller.enqueue(encoder.encode(encodeCoachEvent(event)));
      try {
        // Stream the first draft as it's written so the user isn't staring at
        // "Thinking…" for the whole generation.
        // If a fatalistic line shows up mid-stream, pull what's on screen and
        // stop showing the draft; the retry below replaces it.
        let draft = "";
        let visible = true;
        for await (const chunk of streamCoachResponse(systemPrompt, messages, dynamicBlock, signal)) {
          draft += chunk;
          if (!visible) continue;
          if (isFatalistic(draft)) {
            visible = false;
            emit({ type: "replace", text: "" });
            continue;
          }
          emit({ type: "text", text: chunk });
        }

        const verdict = assessCoachOutput(draft, grounding.chart, grounding.dashas, userText);
        if (verdict.ok) {
          emit({ type: "done", outcome: "ok" });
          return;
        }

        // One corrective retry before falling back — a blocked reply used to be
        // thrown away outright, costing the user the whole turn.
        console.error(`[coach-output] draft blocked (${verdict.reason}); retrying once`);
        let retry = "";
        for await (const chunk of streamCoachResponse(
          systemPrompt,
          messages,
          `${dynamicBlock}\n\n${coachRetryNote(verdict.reason)}`,
          signal
        )) {
          retry += chunk;
        }
        if (assessCoachOutput(retry, grounding.chart, grounding.dashas, userText).ok) {
          emit({ type: "replace", text: retry });
          emit({ type: "done", outcome: "ok" });
        } else {
          console.error("[coach-output] retry blocked too; sending fallback");
          emit({ type: "replace", text: COACH_OUTPUT_FALLBACK });
          emit({ type: "done", outcome: "blocked" });
        }
      } catch (e) {
        if (!signal.aborted) {
          const msg = safeClientErrorMessage(e, "The coach hit a snag. Please try again shortly.", "coach-stream");
          emit({ type: "error", error: msg });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a client disconnect.
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
