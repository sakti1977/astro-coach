import { LEGAL } from "@/lib/legal";

/** Canonical origin for metadata, sitemap and share previews. */
export const SITE_URL = `https://${LEGAL.site}`;

export const SITE_TITLE = "Jyotish Coach — Vedic Astrology Personal Coach";
export const SITE_DESCRIPTION =
  "Your Vedic birth chart, calculated precisely, and an AI coach that turns it into habits and reflection. Free, no upsold remedies.";

/** Public pages worth indexing. Everything else is personal or behind sign-in. */
export const PUBLIC_PATHS = ["/", "/trust", "/support", "/privacy", "/terms"] as const;
