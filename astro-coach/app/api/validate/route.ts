import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateChart } from "@/lib/claude";
import { buildValidatorSystemPrompt, buildValidatorUserPrompt } from "@/lib/astrology/prompts";
import { extractJsonArray } from "@/lib/claude-json";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { resolveNatalGrounding } from "@/lib/server-grounding";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  try {
    const { birthData: clientBirth, birthDate }: {
      birthData?: unknown;
      birthDate?: string;
    } = await req.json();

    const grounding = await resolveNatalGrounding(
      access.session?.user?.id,
      clientBirth
    );
    if (grounding instanceof NextResponse) return grounding;

    const systemPrompt = buildValidatorSystemPrompt();
    const userPrompt = buildValidatorUserPrompt(
      grounding.chart,
      grounding.birthDate || birthDate
    );

    const raw = await validateChart(systemPrompt, userPrompt);
    const questions = extractJsonArray(raw);

    return NextResponse.json({ questions });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Validation failed. Please try again shortly.", "validate");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
