import type { Habit } from "@/lib/profile";
import type { PlanetKey } from "@/lib/astrology/planets";

export type GeneratedHabit = Omit<Habit, "id" | "completedDates" | "streak">;

const PLANETS = new Set<PlanetKey>(["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"]);
const CATEGORIES = new Set(["physical", "mental", "social", "creative", "service"]);

/** Habits are the behavioural layer (NON_NEGOTIABLES.md #11). Ritual items
 * belong to the deterministic remedy table, never to a generated habit list. */
const RITUAL = /\b(?:mantras?|gemstones?|puja|pooja|homam|havan|yagna|yajna|vrat(?:a)?|fasting|fast on)\b/i;

/**
 * Validate model-generated habits before they reach the tracker. Anything
 * malformed, ritual-only, or duplicated is dropped rather than trusted.
 */
export function parseGeneratedHabits(raw: unknown, max = 8): GeneratedHabit[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: GeneratedHabit[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const h = item as Record<string, unknown>;
    const habit = typeof h.habit === "string" ? h.habit.trim() : "";
    const why = typeof h.why === "string" ? h.why.trim() : "";
    const planet = typeof h.planet === "string" ? h.planet.trim().toLowerCase() : "";
    const frequency = h.frequency === "weekly" ? "weekly" : h.frequency === "daily" ? "daily" : null;
    const category = typeof h.category === "string" && CATEGORIES.has(h.category) ? h.category : "mental";
    if (!habit || habit.length > 300 || why.length > 600 || !frequency) continue;
    if (!PLANETS.has(planet as PlanetKey)) continue;
    if (RITUAL.test(habit)) continue;
    const key = habit.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ habit, frequency, planet, category, why });
    if (out.length >= max) break;
  }
  return out;
}
