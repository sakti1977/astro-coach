import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateDashaPrediction } from "@/lib/claude";
import { buildDashaPredictionPrompt } from "@/lib/astrology/prompts";
import { prepareJsonString } from "@/lib/claude-json";
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
    const { chart, dashaLord, antarLord, years } = await req.json() as {
      chart: NatalChart;
      dashaLord: string;
      antarLord: string;
      years: number;
    };

    const prompt = buildDashaPredictionPrompt(chart, dashaLord, antarLord, years, new Date().toISOString());
    const raw = await generateDashaPrediction(prompt);

    // prepareJsonString strips fences, sanitises control chars, and locates the
    // outermost {} — throws if no braces found (caught by outer try/catch below)
    const jsonStr = prepareJsonString(raw);

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

    // Validate that all required fields are present and non-empty
    const pred = prediction as Record<string, unknown>;
    if (!pred.themes || !Array.isArray(pred.themes) || pred.themes.length === 0) {
      pred.themes = ["Personal growth and self-discovery", "Life lessons and experiences", "New opportunities"];
    }
    if (!pred.cultivate || !Array.isArray(pred.cultivate) || pred.cultivate.length === 0) {
      pred.cultivate = ["Patience and perseverance", "Self-awareness", "Balance and moderation"];
    }
    if (!pred.challenges || !Array.isArray(pred.challenges) || pred.challenges.length === 0) {
      pred.challenges = ["Unexpected changes", "Need for adaptability", "Emotional resilience"];
    }
    if (!pred.actions || !Array.isArray(pred.actions) || pred.actions.length === 0) {
      pred.actions = ["Reflect on life goals", "Build strong foundations", "Develop new skills"];
    }
    if (!pred.summary || typeof pred.summary !== "string") {
      pred.summary = "A period of growth and transformation guided by planetary influences.";
    }

    return NextResponse.json({ prediction });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Dasha prediction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
