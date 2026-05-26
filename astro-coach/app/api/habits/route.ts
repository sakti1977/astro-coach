import { NextRequest, NextResponse } from "next/server";
import { generateHabits } from "@/lib/claude";
import { buildHabitPrompt } from "@/lib/astrology/prompts";
import type { NatalChart } from "@/lib/profile";

export async function POST(req: NextRequest) {
  try {
    const { chart, dashaLord, goals, weakPlanets } = await req.json() as {
      chart: NatalChart;
      dashaLord: string;
      goals: string[];
      weakPlanets: string[];
    };

    const prompt = buildHabitPrompt(chart, dashaLord, goals, weakPlanets, new Date().toISOString());
    const raw = await generateHabits(prompt);

    // Strip markdown code fences if present
    const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Claude did not return a valid JSON array. Response: " + raw.slice(0, 200));
    const habits = JSON.parse(match[0]);

    return NextResponse.json({ habits });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Habit generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
