import { z } from "zod";
import type { CoachingObservation, UserProfile } from "@/lib/profile";

const planetSchema = z
  .object({
    sign: z.string().min(1),
    sign_num: z.number().int(),
    degree: z.number(),
    abs_pos: z.number(),
    house: z.number().int().min(1).max(12),
    retrograde: z.boolean(),
    nakshatra: z.object({
      num: z.number(),
      name: z.string().min(1),
      pada: z.number(),
      lord: z.string().min(1),
    }),
  })
  .passthrough();

export const natalChartSchema = z
  .object({
    ascendant: z
      .object({
        sign: z.string().min(1),
        sign_num: z.number().int(),
        degree: z.number(),
        abs_pos: z.number(),
      })
      .passthrough(),
    planets: z
      .record(z.string(), planetSchema)
      .refine((planets) => Boolean(planets.moon), { message: "Natal Moon is required" }),
    moon_nakshatra: z
      .object({
        num: z.number(),
        name: z.string().min(1),
        pada: z.number(),
        lord: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

const periodSchema = z
  .object({
    lord: z.string().min(1),
    years: z.number(),
    start: z.string().min(4),
    end: z.string().min(4),
  })
  .passthrough();

export const dashaDataSchema = z
  .object({
    mahadashas: z
      .array(
        periodSchema.extend({
          balance_years: z.number().optional(),
          antardashas: z.array(periodSchema.passthrough()).optional(),
        })
      )
      .min(1),
    current_maha: z.string().min(1),
    current_antar: z.string().min(1),
    current_pratyantar: z.string().optional(),
    current_maha_end: z.string().min(4),
    current_antar_end: z.string().min(4),
    current_pratyantar_end: z.string().optional(),
    lord_dignity: z.record(z.string(), z.string()).nullable().optional(),
  })
  .passthrough();

const birthDataSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be YYYY-MM-DD"),
  time: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  timezone: z.string().min(1),
  city: z.string().min(1),
});

export const userProfileSchema = z
  .object({
    birthData: birthDataSchema.nullable(),
    chart: natalChartSchema,
    dashas: dashaDataSchema,
    validation: z
      .object({
        questions: z.array(z.unknown()),
        accuracyScore: z.number(),
        confirmedThemes: z.array(z.string()),
        isValidated: z.boolean(),
      })
      .passthrough()
      .optional(),
    goals: z.array(z.unknown()).optional(),
    habits: z.array(z.unknown()).optional(),
    chatHistory: z.array(z.unknown()).optional(),
    coaching: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

/** Cloud sync may push a blank new-account profile (chart still local-only). */
export const syncProfileSchema = userProfileSchema.extend({
  chart: natalChartSchema.nullable(),
  dashas: dashaDataSchema.nullable(),
});

export const observationSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  text: z.string().min(1),
  category: z.enum(["behavior", "emotion", "pattern", "goal", "block"]),
  exchangeIndex: z.number().int(),
});

export const syncPushBodySchema = z.object({
  profile: syncProfileSchema,
  observations: z.array(observationSchema).optional(),
  localUpdatedAt: z.string().optional(),
  force: z.boolean().optional(),
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function fail(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid data shape";
}

export function parseNatalChart(input: unknown): ParseResult<z.infer<typeof natalChartSchema>> {
  const result = natalChartSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: fail(result.error) };
}

export function parseDashaData(input: unknown): ParseResult<z.infer<typeof dashaDataSchema>> {
  const result = dashaDataSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: fail(result.error) };
}

export function parseSyncPushBody(input: unknown): ParseResult<z.infer<typeof syncPushBodySchema>> {
  const result = syncPushBodySchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: fail(result.error) };
}

/**
 * Accepts either a raw UserProfile or the export wrapper
 * `{ profile, observations, exportedAt }` from the Profile page.
 */
export function parseBackupPayload(input: unknown): ParseResult<UserProfile> {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Backup is not a JSON object." };
  }
  const root = input as Record<string, unknown>;
  const candidate = root.profile && typeof root.profile === "object" ? root.profile : root;
  const result = userProfileSchema.safeParse(candidate);
  if (!result.success) {
    return { ok: false, error: `This file doesn't look like a valid Astro Coach backup. ${fail(result.error)}` };
  }
  return { ok: true, value: result.data as unknown as UserProfile };
}

export function parseObservations(input: unknown): CoachingObservation[] {
  const result = z.array(observationSchema).safeParse(input);
  return result.success ? (result.data as CoachingObservation[]) : [];
}
