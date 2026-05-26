/**
 * MAINT-01: prompts.ts is now a barrel re-exporting the five domain modules.
 * All existing imports (`from "@/lib/astrology/prompts"`) continue to work.
 *
 * Domain files:
 *   prompts/validator.ts  — chart validation questions
 *   prompts/coach.ts      — coaching system prompt + dynamic block
 *   prompts/extraction.ts — observation extraction + summarisation
 *   prompts/dasha.ts      — dasha period prediction
 *   prompts/habits.ts     — habit generation
 */
export * from "./prompts/validator";
export * from "./prompts/coach";
export * from "./prompts/extraction";
export * from "./prompts/dasha";
export * from "./prompts/habits";
