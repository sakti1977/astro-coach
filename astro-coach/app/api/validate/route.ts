import { NextRequest, NextResponse } from "next/server";
import { validateChartWithOpus } from "@/lib/claude";
import { buildValidatorSystemPrompt, buildValidatorUserPrompt } from "@/lib/astrology/prompts";
import type { NatalChart } from "@/lib/profile";

export async function POST(req: NextRequest) {
  try {
    const { chart, birthDate }: { chart: NatalChart; birthDate?: string } = await req.json();
    if (!chart) return NextResponse.json({ error: "Chart required" }, { status: 400 });

    const systemPrompt = buildValidatorSystemPrompt();
    const userPrompt = buildValidatorUserPrompt(chart, birthDate);

    const raw = await validateChartWithOpus(systemPrompt, userPrompt);

    const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Claude did not return a valid JSON array");
    const questions = JSON.parse(match[0]);

    return NextResponse.json({ questions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
