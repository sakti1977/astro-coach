import type { CachedTransits } from "@/lib/profile";

/**
 * One or two chart-specific sentences from already-computed transits.
 * Never a generic sun-sign horoscope (SPEC.md §5.1 / G1).
 */
export function buildDailyTransitNote(data: CachedTransits["data"] | undefined): string | null {
  if (!data?.planets) return null;

  const bits: string[] = [];
  if (data.sade_sati) {
    bits.push(
      `Sade Sati is in its ${data.sade_sati.phase} phase (Saturn from your natal Moon). The attached practice is behavioral, not a verdict.`
    );
  }

  const saturn = data.planets.saturn;
  const jupiter = data.planets.jupiter;
  if (saturn) {
    bits.push(
      `Transit Saturn is in ${saturn.sign}, occupying house ${saturn.house_from_natal_lagna} from your lagna.`
    );
  } else if (jupiter) {
    bits.push(
      `Transit Jupiter is in ${jupiter.sign}, occupying house ${jupiter.house_from_natal_lagna} from your lagna.`
    );
  }

  if (bits.length === 0) return null;
  return bits.slice(0, 2).join(" ");
}
