import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateChart } from "@/lib/claude";
import { buildValidatorSystemPrompt, buildValidatorUserPrompt } from "@/lib/astrology/prompts";
import { extractJsonArray } from "@/lib/claude-json";
import { safeClientErrorMessage } from "@/lib/safe-error";
import type { NatalChart } from "@/lib/profile";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  try {
    const { chart, birthDate }: { chart: NatalChart; birthDate?: string } = await req.json();
    if (!chart) return NextResponse.json({ error: "Chart required" }, { status: 400 });

    const systemPrompt = buildValidatorSystemPrompt();
    const userPrompt = buildValidatorUserPrompt(chart, birthDate);

    const raw = await validateChart(systemPrompt, userPrompt);
    const questions = extractJsonArray(raw);

    return NextResponse.json({ questions });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Validation failed. Please try again shortly.", "validate");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
