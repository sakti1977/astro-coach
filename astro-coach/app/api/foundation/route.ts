import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { streamFoundationProfile } from "@/lib/claude";
import { buildCoachSystemPrompt, buildFoundationTask } from "@/lib/astrology/prompts";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { resolveNatalGrounding } from "@/lib/server-grounding";
import { guardCoachText } from "@/lib/coach-output";
import type { CoachTonePreference } from "@/lib/profile";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const { birthData: clientBirth, includeReligiousSolutions, tonePreference } =
    (await req.json()) as {
      birthData: unknown;
      includeReligiousSolutions?: boolean;
      tonePreference?: CoachTonePreference;
    };

  const grounding = await resolveNatalGrounding(
    access.session?.user?.id,
    clientBirth
  );
  if (grounding instanceof NextResponse) return grounding;

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
  const task = buildFoundationTask();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let accumulated = "";
        for await (const chunk of streamFoundationProfile(systemPrompt, task)) {
          accumulated += chunk;
        }
        const text = guardCoachText(accumulated, grounding.chart, grounding.dashas, "");
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = safeClientErrorMessage(e, "Generating your Foundation hit a snag. Please try again shortly.", "foundation-stream");
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
