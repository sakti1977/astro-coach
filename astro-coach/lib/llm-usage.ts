import { MODEL_LIGHT, MODEL_PRIMARY } from "@/lib/constants";

/**
 * Token and spend accounting for model calls. Log-only for now: every call
 * writes one `[llm-usage] {...}` line, so spend per operation can be read from
 * the Railway logs before any limit is built on top of it.
 *
 * Privacy: lines carry the operation, model and token counts only. No user id,
 * prompt or reply text.
 */

export type LlmOperation =
  | "validate"
  | "coach"
  | "foundation"
  | "dasha"
  | "habits"
  | "extract"
  | "summarise"
  | "plan_habits";

/** The subset of the API's usage object we read; cache fields are null/absent when unused. */
export interface LlmUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** USD per million tokens. Keep in step with MODEL_PRIMARY / MODEL_LIGHT (a test enforces coverage). */
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  [MODEL_PRIMARY]: { input: 2, output: 10 },
  [MODEL_LIGHT]: { input: 1, output: 5 },
};

// Prompt caching: reads cost 10% of the input price, 5-minute writes 125%.
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

const n = (value: number | null | undefined): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Estimated USD for one call, or null when the model has no price entry (so a new model never reports a silent $0). */
export function estimateCostUsd(model: string, usage: LlmUsage): number | null {
  const price = PRICE_PER_MTOK[model];
  if (!price) return null;
  const cost =
    (n(usage.input_tokens) * price.input
      + n(usage.cache_read_input_tokens) * price.input * CACHE_READ_MULTIPLIER
      + n(usage.cache_creation_input_tokens) * price.input * CACHE_WRITE_MULTIPLIER
      + n(usage.output_tokens) * price.output)
    / 1_000_000;
  return cost;
}

/** Log one call's usage. Never throws: accounting must not be able to fail a coaching turn. */
export function recordLlmUsage(operation: LlmOperation, model: string, usage: LlmUsage | null | undefined): void {
  try {
    const u = usage ?? {};
    const usd = estimateCostUsd(model, u);
    console.info(
      `[llm-usage] ${JSON.stringify({
        op: operation,
        model,
        in: n(u.input_tokens),
        out: n(u.output_tokens),
        cacheRead: n(u.cache_read_input_tokens),
        cacheWrite: n(u.cache_creation_input_tokens),
        usd: usd === null ? null : Number(usd.toFixed(6)),
      })}`
    );
  } catch {
    // Deliberately swallowed.
  }
}

interface StreamEventLike {
  type: string;
  message?: { usage?: LlmUsage };
  usage?: LlmUsage;
}

/**
 * Collects usage from a stream's events as they arrive, so a reply the user
 * stops partway (still billed) is counted too, not only streams that finish.
 * `message_start` carries input and cache tokens; `message_delta` carries the
 * running output total.
 */
export function createStreamUsageTracker() {
  const total: Required<{ [K in keyof LlmUsage]: number }> = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
  return {
    observe(event: StreamEventLike): void {
      const u = event.type === "message_start" ? event.message?.usage : event.type === "message_delta" ? event.usage : undefined;
      if (!u) return;
      // Later events carry running totals, so take the latest non-null value of each field.
      if (typeof u.input_tokens === "number") total.input_tokens = u.input_tokens;
      if (typeof u.output_tokens === "number") total.output_tokens = u.output_tokens;
      if (typeof u.cache_creation_input_tokens === "number") total.cache_creation_input_tokens = u.cache_creation_input_tokens;
      if (typeof u.cache_read_input_tokens === "number") total.cache_read_input_tokens = u.cache_read_input_tokens;
    },
    usage(): LlmUsage {
      return { ...total };
    },
  };
}
