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

    // Strip markdown fences and any preamble text
    let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

    // Find the JSON object - look for first { and last }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
      console.error("Raw response:", raw);
      throw new Error("Claude did not return valid JSON - no braces found");
    }

    let jsonStr = cleaned.slice(start, end + 1);

    // More robust sanitization of control characters
    jsonStr = jsonStr.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, (c) => {
      // Keep \n and \t as they should be escaped
      return " ";
    });

    // Ensure newlines and tabs are properly escaped if they aren't already
    jsonStr = jsonStr.replace(/(?<!\\)\n/g, "\\n");
    jsonStr = jsonStr.replace(/(?<!\\)\t/g, "\\t");

    let prediction: unknown;
    try {
      prediction = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Failed JSON string:", jsonStr.substring(0, 500));

      // Fallback: manually extract each field via regex
      const extractList = (key: string) => {
        const match = jsonStr.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`));
        if (!match) return [];
        return match[1]
          .match(/"((?:[^"\\]|\\.)*)"/g)
          ?.map((s: string) => s.slice(1, -1).replace(/\\n/g, "\n").replace(/\\t/g, "\t")) ?? [];
      };

      const summaryMatch = jsonStr.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const summary = summaryMatch ? summaryMatch[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t") : "";

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
