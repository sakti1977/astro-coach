import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractPlanHabits } from "@/lib/claude";
import { buildPlanHabitsPrompt } from "@/lib/astrology/prompts";
import { extractJsonArray } from "@/lib/claude-json";
import { parseGeneratedHabits, type GeneratedHabit } from "@/lib/habit-schema";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { COACH_MAX_PLAN_CHARS } from "@/lib/coach-request";

/**
 * Closes the loop between a delivered coaching plan and the Sadhana tracker
 * (SPEC.md §5.4 #15). Only restructures the plan the grounded coach already
 * wrote; habit completion then flows back into later coaching turns via
 * formatHabitsForCoach.
 */
export async function planToHabits(
  plan: string,
  extract: (prompt: string) => Promise<string>
): Promise<GeneratedHabit[]> {
  const raw = await extract(buildPlanHabitsPrompt(plan));
  return parseGeneratedHabits(extractJsonArray(raw), 5);
}

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { plan?: unknown } | null;
  const plan = typeof body?.plan === "string" ? body.plan.trim() : "";
  if (!plan || plan.length > COACH_MAX_PLAN_CHARS) {
    return NextResponse.json({ error: "A delivered plan is required." }, { status: 400 });
  }

  try {
    const habits = await planToHabits(plan, extractPlanHabits);
    return NextResponse.json({ habits });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Couldn't turn the plan into habits. Please try again.", "coach/plan-habits");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
