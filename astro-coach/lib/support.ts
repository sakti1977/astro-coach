/**
 * Voluntary UPI contributions. Honour-based by design: a plain UPI ID has no
 * payment callback, so nothing in the app is ever gated on paying, and the
 * ask never appears inside coaching output or next to a remedy
 * (NON_NEGOTIABLES.md #15 — contributions never buy a remedy).
 *
 * Configured at build time (NEXT_PUBLIC_* is inlined into the client bundle):
 *   NEXT_PUBLIC_UPI_ID          e.g. jyotishcoach@ybl   — feature hidden when unset
 *   NEXT_PUBLIC_UPI_PAYEE_NAME  shown in the payer's UPI app
 */

export const SUPPORT_PRESET_AMOUNTS = [51, 101, 251] as const;
export const SUPPORT_MIN_AMOUNT = 1;
export const SUPPORT_MAX_AMOUNT = 100_000; // UPI's standard per-transaction ceiling
const DEFAULT_PAYEE_NAME = "Jyotish Coach";
const NOTE = "Support Jyotish Coach";

// handle@psp — the handle allows letters, digits, dot, hyphen, underscore.
const VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export interface SupportConfig {
  upiId: string;
  payeeName: string;
}

export function isValidUpiId(value: string): boolean {
  return VPA.test(value.trim());
}

export function readSupportConfig(
  upiId: string | undefined = process.env.NEXT_PUBLIC_UPI_ID,
  payeeName: string | undefined = process.env.NEXT_PUBLIC_UPI_PAYEE_NAME
): SupportConfig | null {
  const id = upiId?.trim() ?? "";
  if (!isValidUpiId(id)) return null;
  const name = payeeName?.trim().slice(0, 50) || DEFAULT_PAYEE_NAME;
  return { upiId: id, payeeName: name };
}

/** Whole rupees in range, or null. */
export function normaliseAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < SUPPORT_MIN_AMOUNT || n > SUPPORT_MAX_AMOUNT) return null;
  return n;
}

/**
 * NPCI UPI deep link. With no amount the payer types one in their app.
 * Every value is URI-encoded; the ID itself is validated first so a bad
 * configuration can't produce a link that pays somewhere unexpected.
 */
export function buildUpiLink(config: SupportConfig, amount?: number | null): string {
  const params: Array<[string, string]> = [
    ["pa", config.upiId],
    ["pn", config.payeeName],
    ["cu", "INR"],
    ["tn", NOTE],
  ];
  const am = normaliseAmount(amount);
  if (am !== null) params.push(["am", am.toFixed(2)]);
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
