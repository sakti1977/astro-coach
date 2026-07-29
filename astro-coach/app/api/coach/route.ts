import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { streamCoachResponse } from "@/lib/claude";
import { buildCoachSystemPrompt, buildCoachDynamicBlock } from "@/lib/astrology/prompts";
import type { NatalChart, DashaData, ChatMessage, CoachingPhase } from "@/lib/profile";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const { chart, dashas, goals, profileContext, vargaContext, messages, phase, includeReligiousSolutions, transitContext } =
    (await req.json()) as {
      chart: NatalChart;
      dashas: DashaData;
      goals: string[];
      profileContext: string;
      vargaContext?: string;
      messages: ChatMessage[];
      phase?: CoachingPhase;
      includeReligiousSolutions?: boolean;
      transitContext?: string;
    };

  // Authoritative current date/time — always computed server-side so Claude
  // has an accurate, unambiguous "now" anchor regardless of client timezone.
  const todayIso = new Date().toISOString();

  // TOKEN-03/04: Block 1 (cached) — chart + dasha timing + guidelines only.
  // phase, goals, vargaContext moved to Block 2 so their changes never bust
  // the ephemeral cache on the large static block.
  const systemPrompt = buildCoachSystemPrompt(
    chart,
    dashas,
    todayIso,
    includeReligiousSolutions ?? true,
    chart.yogas ?? [],
    chart.doshas ?? []
  );

  // Block 2 (uncached) — everything that can change mid-session.
  const dynamicBlock = buildCoachDynamicBlock(
    phase ?? "gathering",
    goals,
    vargaContext,
    profileContext,
    transitContext
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
        for await (const chunk of streamCoachResponse(systemPrompt, apiMessages, dynamicBlock)) {
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
