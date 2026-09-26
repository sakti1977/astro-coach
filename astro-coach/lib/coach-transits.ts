import { fetchTransits } from "@/lib/ephemeris";
import { buildTransitContext } from "@/lib/astrology/prompts";
import type { CachedTransits, NatalChart } from "@/lib/profile";

/**
 * Server-side transit context for the coach. The browser used to send a
 * pre-rendered transit string, which the server then trusted verbatim; now
 * transits are fetched here from the same ephemeris the chart came from.
 * Slow planets move little in an hour, so results are memoised per
 * (lagna, moon sign, zone) for a short TTL to keep the sidecar off the hot path.
 */

const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; context: string }>();

export async function serverTransitContext(chart: NatalChart, timezone?: string): Promise<string> {
  const asc = chart.ascendant.sign_num;
  const moon = chart.planets.moon?.sign_num;
  const tz = timezone || "UTC";
  const key = `${asc}:${moon ?? "-"}:${tz}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.context;

  try {
    const data = (await fetchTransits({
      natal_asc_sign_num: asc,
      natal_moon_sign_num: moon,
      tz_str: tz,
    })) as CachedTransits["data"];
    const context = data?.planets ? buildTransitContext(data) : "";
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), context });
    return context;
  } catch (err) {
    // Non-critical: coaching still works from the natal chart and dashas.
    console.error("[coach-transits] transit fetch failed", err instanceof Error ? err.message : err);
    return "";
  }
}
