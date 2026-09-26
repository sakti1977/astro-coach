import { z } from "zod";
import type { ChatMessage, Habit } from "@/lib/profile";
import type { ParseResult } from "@/lib/profile-schema";

/**
 * Request contract for /api/coach (NON_NEGOTIABLES.md #7). Everything the
 * browser sends is bounded here before it can reach a prompt. Chart, dasha,
 * transit and varga context are deliberately NOT accepted: the server derives
 * those itself from the stored or recomputed chart.
 */

export const COACH_MAX_MESSAGES = 40;
export const COACH_MAX_MESSAGE_CHARS = 8_000;
export const COACH_MAX_CONTEXT_CHARS = 6_000;
export const COACH_MAX_PLAN_CHARS = 12_000;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(COACH_MAX_MESSAGE_CHARS),
});

const habitSchema = z
  .object({
    habit: z.string().max(500),
    frequency: z.enum(["daily", "weekly"]),
    planet: z.string().max(20),
    completedDates: z.array(z.string().max(10)).max(1000).optional(),
    streak: z.number().int().min(0).max(100_000).optional(),
  })
  .passthrough();

const coachRequestSchema = z.object({
  birthData: z.unknown().optional(),
  goals: z.array(z.string().max(300)).max(20).optional(),
  habits: z.array(habitSchema).max(50).optional(),
  profileContext: z.string().max(COACH_MAX_CONTEXT_CHARS).optional(),
  deliveredPlan: z.string().max(COACH_MAX_PLAN_CHARS).optional(),
  messages: z.array(messageSchema).min(1).max(COACH_MAX_MESSAGES),
  phase: z.enum(["gathering", "recommending"]).optional(),
  planDelivered: z.boolean().optional(),
  includeReligiousSolutions: z.boolean().optional(),
  tonePreference: z.enum(["jyotish", "skeptic"]).optional(),
});

export type CoachRequest = Omit<z.infer<typeof coachRequestSchema>, "habits" | "messages"> & {
  habits: Habit[];
  messages: Array<Pick<ChatMessage, "role" | "content">>;
};

/**
 * Make a history the Messages API will accept: no empty turns (a failed reply
 * used to be saved as "" and poison every later request), no two turns in a
 * row from the same role, starts with the user and ends with the user.
 */
export function normalizeCoachMessages(
  messages: Array<Pick<ChatMessage, "role" | "content">>
): Array<Pick<ChatMessage, "role" | "content">> {
  const out: Array<Pick<ChatMessage, "role" | "content">> = [];
  for (const m of messages) {
    const content = m.content.trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      out.push({ role: m.role, content });
    }
  }
  while (out.length > 0 && out[0].role !== "user") out.shift();
  while (out.length > 0 && out[out.length - 1].role !== "user") out.pop();
  return out;
}

export function parseCoachRequest(input: unknown): ParseResult<CoachRequest> {
  const result = coachRequestSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, error: "Invalid coaching request." };
  }
  const messages = normalizeCoachMessages(result.data.messages);
  if (messages.length === 0) {
    return { ok: false, error: "Send a message to get guidance." };
  }
  return {
    ok: true,
    value: {
      ...result.data,
      habits: (result.data.habits ?? []) as unknown as Habit[],
      messages,
    },
  };
}
