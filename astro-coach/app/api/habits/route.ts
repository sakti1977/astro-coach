import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateHabits } from "@/lib/claude";
import { buildHabitPrompt } from "@/lib/astrology/prompts";
import { extractJsonArray } from "@/lib/claude-json";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { resolveNatalGrounding } from "@/lib/server-grounding";
import { parseGeneratedHabits } from "@/lib/habit-schema";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  try {
    const { birthData: clientBirth, dashaLord, goals: clientGoals, weakPlanets } = await req.json() as {
      birthData: unknown;
      dashaLord: string;
      goals: string[];
      weakPlanets: string[];
    };

    const grounding = await resolveNatalGrounding(
      access.session?.user?.id,
      clientBirth
    );
    if (grounding instanceof NextResponse) return grounding;

    const goals =
      grounding.source === "server"
        ? grounding.goals.map((g) => g.description)
        : (clientGoals ?? []);
    const lord = dashaLord || grounding.dashas.current_maha;

    const prompt = buildHabitPrompt(grounding.chart, lord, goals, weakPlanets ?? [], new Date().toISOString());
    const raw = await generateHabits(prompt);
    const habits = parseGeneratedHabits(extractJsonArray(raw));

    return NextResponse.json({ habits });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Habit generation failed. Please try again shortly.", "habits");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
