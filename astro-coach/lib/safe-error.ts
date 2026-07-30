// NON_NEGOTIABLES.md #5 (no internal topology leaks): errors from upstream
// SDKs (Claude, Supabase, Sarvam, the ephemeris service) can contain infra
// detail — internal URLs, schema/table names, provider response bodies.
// Log the full detail server-side always; only echo it to the client outside
// production, where a generic fallback is returned instead.
export function safeClientErrorMessage(err: unknown, fallback: string, logPrefix = "error"): string {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[${logPrefix}] ${detail}`);
  if (process.env.NODE_ENV !== "production") {
    return detail;
  }
  return fallback;
}
