import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateHabits } from "@/lib/claude";
import { buildHabitPrompt } from "@/lib/astrology/prompts";
import { extractJsonArray } from "@/lib/claude-json";
import { safeClientErrorMessage } from "@/lib/safe-error";
import type { NatalChart } from "@/lib/profile";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
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
    const msg = safeClientErrorMessage(err, "Habit generation failed. Please try again shortly.", "habits");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
