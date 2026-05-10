import { NextRequest, NextResponse } from "next/server";
import { generateDashaPrediction } from "@/lib/claude";
import { buildDashaPredictionPrompt } from "@/lib/astrology/prompts";
import type { NatalChart } from "@/lib/profile";

export async function POST(req: NextRequest) {
  try {
    const { chart, dashaLord, antarLord, years } = await req.json() as {
      chart: NatalChart;
      dashaLord: string;
      antarLord: string;
      years: number;
    };

    const prompt = buildDashaPredictionPrompt(chart, dashaLord, antarLord, years);
    const raw = await generateDashaPrediction(prompt);

    const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Claude did not return valid JSON");
    const prediction = JSON.parse(match[0]);

    return NextResponse.json({ prediction });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Dasha prediction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
