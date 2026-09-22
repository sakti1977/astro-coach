import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { streamCoachResponse } from "@/lib/claude";
import { buildCoachSystemPrompt, buildCoachDynamicBlock } from "@/lib/astrology/prompts";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { formatHabitsForCoach, resolveNatalGrounding } from "@/lib/server-grounding";
import { guardCoachText } from "@/lib/coach-output";
import type { ChatMessage, CoachingPhase, CoachTonePreference, Habit } from "@/lib/profile";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const {
    birthData: clientBirth,
    goals: clientGoals,
    habits: clientHabits,
    profileContext,
    vargaContext,
    messages,
    phase,
    planDelivered,
    includeReligiousSolutions,
    transitContext,
    tonePreference,
  } = (await req.json()) as {
    birthData: unknown;
    goals: string[];
    habits?: Habit[];
    profileContext: string;
    vargaContext?: string;
    messages: ChatMessage[];
    phase?: CoachingPhase;
    planDelivered?: boolean;
    includeReligiousSolutions?: boolean;
    transitContext?: string;
    tonePreference?: CoachTonePreference;
  };

  const grounding = await resolveNatalGrounding(
    access.session?.user?.id,
    clientBirth
  );
  if (grounding instanceof NextResponse) return grounding;

  const goals =
    grounding.source === "server"
      ? grounding.goals.map((g) => g.description)
      : (clientGoals ?? []);
  const habitsSummary = formatHabitsForCoach(
    grounding.source === "server" ? grounding.habits : (clientHabits ?? [])
  );

  const todayIso = new Date().toISOString();

  const systemPrompt = buildCoachSystemPrompt(
    grounding.chart,
    grounding.dashas,
    todayIso,
    includeReligiousSolutions ?? false,
    grounding.chart.yogas ?? [],
    grounding.chart.doshas ?? [],
    tonePreference ?? "jyotish"
  );

  const dynamicBlock = buildCoachDynamicBlock(
    phase ?? "gathering",
    goals,
    vargaContext,
    profileContext,
    transitContext,
    planDelivered ?? false,
    habitsSummary
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
        const userText = apiMessages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
        let accumulated = "";
        for await (const chunk of streamCoachResponse(systemPrompt, apiMessages, dynamicBlock)) {
          accumulated += chunk;
        }
        const text = guardCoachText(accumulated, grounding.chart, grounding.dashas, userText);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = safeClientErrorMessage(e, "The coach hit a snag. Please try again shortly.", "coach-stream");
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
