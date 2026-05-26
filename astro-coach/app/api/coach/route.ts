import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { streamCoachResponse } from "@/lib/claude";
import { buildCoachSystemPrompt, buildCoachDynamicBlock } from "@/lib/astrology/prompts";
import type { NatalChart, DashaData, ChatMessage, CoachingPhase } from "@/lib/profile";

export async function POST(req: NextRequest) {
  // BUG-02: guard Claude spend — only enforce when auth is configured
  if (process.env.NEXTAUTH_SECRET) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // SCALE-01: 20 requests / minute per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
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

  // TOKEN-03/04: Block 1 (cached) — chart + dasha timing + guidelines only.
  // phase, goals, vargaContext moved to Block 2 so their changes never bust
  // the ephemeral cache on the large static block.
  const systemPrompt = buildCoachSystemPrompt(
    chart,
    dashas,
    todayIso,
    includeReligiousSolutions ?? false
  );

  // Block 2 (uncached) — everything that can change mid-session.
  const dynamicBlock = buildCoachDynamicBlock(
    phase ?? "gathering",
    goals,
    vargaContext,
    profileContext
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
