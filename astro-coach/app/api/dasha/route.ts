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

    let jsonStr = match[0];
    // Remove control characters that break JSON parsing
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (c) => {
      if (c === "\n") return "\\n";
      if (c === "\t") return "\\t";
      return "";
    });

    let prediction: unknown;
    try {
      prediction = JSON.parse(jsonStr);
    } catch {
      // Last resort: extract arrays manually if JSON is malformed
      const themes = jsonStr.match(/"themes"\s*:\s*\[([^\]]*)\]/)?.[1]?.match(/"([^"]+)"/g)?.map((s: string) => s.replace(/"/g, "")) ?? [];
      const cultivate = jsonStr.match(/"cultivate"\s*:\s*\[([^\]]*)\]/)?.[1]?.match(/"([^"]+)"/g)?.map((s: string) => s.replace(/"/g, "")) ?? [];
      const challenges = jsonStr.match(/"challenges"\s*:\s*\[([^\]]*)\]/)?.[1]?.match(/"([^"]+)"/g)?.map((s: string) => s.replace(/"/g, "")) ?? [];
      const actions = jsonStr.match(/"actions"\s*:\s*\[([^\]]*)\]/)?.[1]?.match(/"([^"]+)"/g)?.map((s: string) => s.replace(/"/g, "")) ?? [];
      const summary = jsonStr.match(/"summary"\s*:\s*"([^"]+)"/)?.[1] ?? "";
      prediction = { themes, cultivate, challenges, actions, summary };
    }

    return NextResponse.json({ prediction });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Dasha prediction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
