import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateHabits } from "@/lib/claude";
import { buildHabitPrompt } from "@/lib/astrology/prompts";
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
    const { chart, dashaLord, goals, weakPlanets } = await req.json() as {
      chart: NatalChart;
      dashaLord: string;
      goals: string[];
      weakPlanets: string[];
    };

    const prompt = buildHabitPrompt(chart, dashaLord, goals, weakPlanets, new Date().toISOString());
    const raw = await generateHabits(prompt);
    const habits = extractJsonArray(raw);

    return NextResponse.json({ habits });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Habit generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
