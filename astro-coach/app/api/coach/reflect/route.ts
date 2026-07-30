import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractObservations, summariseObservations } from "@/lib/claude";
import {
  buildObservationExtractionPrompt,
  buildObservationSummarisationPrompt,
  parseExtractionResult,
  parseSummarisationResult,
} from "@/lib/astrology/prompts";
import { extractJsonObject } from "@/lib/claude-json";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { OBS_CAP, OBS_SUMMARISE_EVERY } from "@/lib/constants";
import type { CoachingObservation } from "@/lib/profile";

/**
 * Post-turn reflection orchestrator: coordinates the Extraction Agent and the
 * Summarisation Agent that used to be two separate, client-triggered,
 * fire-and-forget routes (see git history: app/api/coach/extract,
 * app/api/coach/summarise). Neither agent generates coaching advice — they
 * only restructure/compress observation data that flows back into the
 * existing buildCoachSystemPrompt-grounded coach call on the next turn, so
 * this orchestration stays on the single grounded advice pathway required by
 * NON_NEGOTIABLES.md #13.
 */

export interface ReflectInput {
  userMessage: string;
  assistantResponse: string;
  exchangeCount: number;
  existingObservations: CoachingObservation[];
}

export interface ReflectResult {
  finalObservations: CoachingObservation[];
  shouldTransitionToRecommending: boolean;
  summarised: boolean;
  /** True when the extraction or summarisation agent failed and a graceful
   * fallback was used — surfaced to the caller instead of silently swallowed. */
  degraded: boolean;
  error?: string;
}

interface ReflectDeps {
  extract: (prompt: string) => Promise<string>;
  summarise: (prompt: string) => Promise<string>;
}

function toObservation(o: { text: string; category: CoachingObservation["category"] }, exchangeIndex: number): CoachingObservation {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    text: o.text,
    category: o.category,
    exchangeIndex,
  };
}

export async function runReflection(input: ReflectInput, deps: ReflectDeps): Promise<ReflectResult> {
  const { userMessage, assistantResponse, exchangeCount, existingObservations } = input;

  let extraction;
  try {
    const prompt = buildObservationExtractionPrompt(userMessage, assistantResponse, exchangeCount, new Date().toISOString());
    const raw = await deps.extract(prompt);
    extraction = parseExtractionResult(extractJsonObject(raw));
  } catch (err) {
    return {
      finalObservations: existingObservations,
      shouldTransitionToRecommending: false,
      summarised: false,
      degraded: true,
      error: safeClientErrorMessage(err, "Observation extraction failed", "coach/reflect:extract"),
    };
  }

  const newObservations = extraction.observations.map((o) => toObservation(o, exchangeCount));
  let merged = [...existingObservations, ...newObservations];
  if (merged.length > OBS_CAP) merged = merged.slice(-OBS_CAP);

  const dueForSummary = exchangeCount > 0 && exchangeCount % OBS_SUMMARISE_EVERY === 0 && merged.length > 0;
  if (!dueForSummary) {
    return {
      finalObservations: merged,
      shouldTransitionToRecommending: extraction.shouldTransitionToRecommending,
      summarised: false,
      degraded: false,
    };
  }

  try {
    const prompt = buildObservationSummarisationPrompt(merged, exchangeCount);
    const raw = await deps.summarise(prompt);
    const { summaryObservations } = parseSummarisationResult(extractJsonObject(raw));
    if (summaryObservations.length === 0) {
      // Model returned nothing usable — keep the merged list rather than losing data.
      return {
        finalObservations: merged,
        shouldTransitionToRecommending: extraction.shouldTransitionToRecommending,
        summarised: false,
        degraded: false,
      };
    }
    return {
      finalObservations: summaryObservations.map((o) => toObservation(o, exchangeCount)),
      shouldTransitionToRecommending: extraction.shouldTransitionToRecommending,
      summarised: true,
      degraded: false,
    };
  } catch (err) {
    return {
      finalObservations: merged,
      shouldTransitionToRecommending: extraction.shouldTransitionToRecommending,
      summarised: false,
      degraded: true,
      error: safeClientErrorMessage(err, "Observation summarisation failed", "coach/reflect:summarise"),
    };
  }
}

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const body = (await req.json()) as Partial<ReflectInput>;
  if (
    typeof body.userMessage !== "string" ||
    typeof body.assistantResponse !== "string" ||
    typeof body.exchangeCount !== "number" ||
    !Array.isArray(body.existingObservations)
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await runReflection(
    {
      userMessage: body.userMessage,
      assistantResponse: body.assistantResponse,
      exchangeCount: body.exchangeCount,
      existingObservations: body.existingObservations,
    },
    { extract: extractObservations, summarise: summariseObservations }
  );

  return NextResponse.json(result);
}
