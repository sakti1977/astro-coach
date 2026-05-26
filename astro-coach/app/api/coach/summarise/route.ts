import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { summariseObservations } from "@/lib/claude";
import { buildObservationSummarisationPrompt } from "@/lib/astrology/prompts";
import { extractJsonObject } from "@/lib/claude-json";
import type { CoachingObservation } from "@/lib/profile";

export async function POST(req: NextRequest) {
  // Auth guard — consistent with all Claude routes
  if (process.env.NEXTAUTH_SECRET) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { observations, exchangeCount } = (await req.json()) as {
    observations: CoachingObservation[];
    exchangeCount: number;
  };

  if (!observations?.length) {
    return NextResponse.json({ summaryObservations: [] });
  }

  try {
    const prompt = buildObservationSummarisationPrompt(observations, exchangeCount);
    const raw = await summariseObservations(prompt);
    const parsed = extractJsonObject(raw) as { summaryObservations?: Array<{ text: string; category: string }> };

    const summaryObservations: CoachingObservation[] = (parsed.summaryObservations ?? []).map((o) => ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      text: o.text,
      category: o.category as CoachingObservation["category"],
      exchangeIndex: exchangeCount,
    }));

    return NextResponse.json({ summaryObservations });
  } catch {
    // Summarisation failure is non-fatal — return empty so caller keeps originals
    return NextResponse.json({ summaryObservations: [] });
  }
}
