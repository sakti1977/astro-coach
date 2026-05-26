import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { streamCoachResponse } from "@/lib/claude";
import { buildCoachSystemPrompt } from "@/lib/astrology/prompts";
import type { NatalChart, DashaData, ChatMessage, CoachingPhase } from "@/lib/profile";

export async function POST(req: NextRequest) {
  // BUG-02: guard Claude spend — only enforce when auth is configured
  if (process.env.NEXTAUTH_SECRET) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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

  // Authoritative current date/time — always computed server-side so Claude
  // has an accurate, unambiguous "now" anchor regardless of client timezone.
  const todayIso = new Date().toISOString();

  // profileContext (dynamic observations + current date) is passed separately to
  // streamCoachResponse so the large static system prompt block is always
  // cache-hit after the first call in a session.
  const systemPrompt = buildCoachSystemPrompt(
    chart,
    dashas,
    goals,
    todayIso,
    vargaContext,
    phase ?? "gathering",
    includeReligiousSolutions ?? false
  );

  // Prepend today's date to the dynamic context block so it's always current
  // even if profileContext itself hasn't changed.
  const now = new Date(todayIso);
  const dynamicContext = `Current date: ${now.toDateString()} (${todayIso})\n${profileContext}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
        for await (const chunk of streamCoachResponse(systemPrompt, apiMessages, dynamicContext)) {
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
