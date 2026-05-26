import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validateChart } from "@/lib/claude";
import { buildValidatorSystemPrompt, buildValidatorUserPrompt } from "@/lib/astrology/prompts";
import { extractJsonArray } from "@/lib/claude-json";
import type { NatalChart } from "@/lib/profile";

export async function POST(req: NextRequest) {
  // BUG-02: guard Claude spend — only enforce when auth is configured
  if (process.env.NEXTAUTH_SECRET) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    const msg = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
