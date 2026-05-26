import { NextRequest } from "next/server";
import { streamCoachResponse } from "@/lib/claude";
import { buildCoachSystemPrompt } from "@/lib/astrology/prompts";
import type { NatalChart, DashaData, ChatMessage, CoachingPhase } from "@/lib/profile";

export async function POST(req: NextRequest) {
  const { chart, dashas, goals, profileContext, vargaContext, messages, phase, includeReligiousSolutions } =
    (await req.json()) as {
      chart: NatalChart;
      dashas: DashaData;
      goals: string[];
      profileContext: string;
      vargaContext?: string;
      messages: ChatMessage[];
      phase?: CoachingPhase;
      includeReligiousSolutions?: boolean;
    };

  // profileContext (dynamic observations) is passed separately to streamCoachResponse
  // so the large static system prompt block is always cache-hit after the first call.
  const systemPrompt = buildCoachSystemPrompt(
    chart,
    dashas,
    goals,
    vargaContext,
    phase ?? "gathering",
    includeReligiousSolutions ?? false
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
        for await (const chunk of streamCoachResponse(systemPrompt, apiMessages, profileContext)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stream error";
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
