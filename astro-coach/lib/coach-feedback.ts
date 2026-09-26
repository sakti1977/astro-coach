import { z } from "zod";
import type { ParseResult } from "@/lib/profile-schema";
import { COACH_MAX_PLAN_CHARS } from "@/lib/coach-request";

export type FeedbackRating = "up" | "down";

export const FEEDBACK_REASONS = [
  { id: "not_accurate", label: "Doesn't fit me" },
  { id: "too_generic", label: "Too generic" },
  { id: "not_helpful", label: "Not practical" },
  { id: "too_long", label: "Too long" },
  { id: "other", label: "Something else" },
] as const;

export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]["id"];

const reasonIds = FEEDBACK_REASONS.map((r) => r.id) as [FeedbackReason, ...FeedbackReason[]];

const feedbackSchema = z.object({
  messageTimestamp: z.string().datetime({ offset: true }),
  /** null clears an earlier rating. */
  rating: z.enum(["up", "down"]).nullable(),
  reason: z.enum(reasonIds).optional(),
  reply: z.string().min(1).max(COACH_MAX_PLAN_CHARS),
  phase: z.enum(["gathering", "recommending"]).optional(),
  tone: z.enum(["jyotish", "skeptic"]).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export function parseFeedback(input: unknown): ParseResult<FeedbackInput> {
  const result = feedbackSchema.safeParse(input);
  if (!result.success) return { ok: false, error: "Invalid feedback." };
  // A reason only makes sense on a thumbs-down.
  if (result.data.rating !== "down" && result.data.reason) {
    return { ok: true, value: { ...result.data, reason: undefined } };
  }
  return { ok: true, value: result.data };
}
