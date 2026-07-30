import type { DignityTier } from "@/lib/profile";

/** Non-fatalistic phrasing per NON_NEGOTIABLES.md G3 — never "good"/"bad" verdict language. */
export function dignityPhrase(tier: DignityTier | null | undefined): string | null {
  switch (tier) {
    case "exalted":
      return "operating from real strength";
    case "own":
      return "in its own sign, a supportive period";
    case "debilitated":
      return "a period that may ask more deliberate effort";
    case "neutral":
    default:
      return null; // "neutral" says nothing rather than force a flat label
  }
}
