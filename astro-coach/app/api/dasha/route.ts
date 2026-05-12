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

    // Strip markdown fences, then find the outermost JSON object
    const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Claude did not return valid JSON");

    let jsonStr = stripped.slice(start, end + 1);
    // Sanitize control characters that break JSON.parse
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (c) => {
      if (c === "\n") return "\\n";
      if (c === "\t") return "\\t";
      return " ";
    });

    let prediction: unknown;
    try {
      prediction = JSON.parse(jsonStr);
    } catch {
      // Fallback: manually extract each field via regex
      const extractList = (key: string) =>
        jsonStr.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`))?.[1]
          ?.match(/"((?:[^"\\]|\\.)*)"/g)
          ?.map((s: string) => s.slice(1, -1)) ?? [];
      const summary = jsonStr.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? "";
      prediction = {
        themes: extractList("themes"),
        cultivate: extractList("cultivate"),
        challenges: extractList("challenges"),
        actions: extractList("actions"),
        summary,
      };
    }

    return NextResponse.json({ prediction });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Dasha prediction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
