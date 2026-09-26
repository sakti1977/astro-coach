/**
 * Crisis detection for the coaching chat. When someone signals they may harm
 * themselves, the right response is not a chart reading: the coach steps out
 * of astrology entirely and points to people who can help right now.
 *
 * Deliberately a small, high-recall pattern list run on the user's latest
 * message only. A false positive costs one gentle, non-astrological reply;
 * a false negative costs far more.
 */

const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid(?:e|al)\b/i,
  /\bkill(?:ing)? my ?self\b/i,
  /\bend(?:ing)? (?:my|it all|my own) life\b/i,
  /\bend it all\b/i,
  /\btake my (?:own )?life\b/i,
  /\b(?:want|wanted|wanting|going) to die\b/i,
  /\bdon'?t want to (?:live|be alive|exist) any ?more\b/i,
  /\bno (?:reason|point) (?:to|in) (?:live|living|going on)\b/i,
  /\bbetter off dead\b/i,
  /\bself[- ]?harm/i,
  /\b(?:cut(?:ting)?|hurt(?:ing)?|harm(?:ing)?) my ?self\b/i,
  /\boverdose\b/i,
  /\b(?:aatmahatya|atmahatya|khudkushi)\b/i,
  /\bmar(?:na|ne) (?:chahta|chahti)\b/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

export const CRISIS_RESPONSE = `I'm really glad you told me. What you're carrying sounds heavy, and you deserve support from a real person right now, not a chart reading.

**Please reach out now:**
- **Tele-MANAS (India, free, 24×7):** call **14416** or **1-800-891-4416**. You can speak in your own language.
- **If you are in immediate danger:** call **112** (India) or your local emergency number.
- Outside India, contact your local emergency number or a crisis line where you live.

If you can, tell one person you trust how you're feeling today, and stay with them or somewhere safe.

I'm here to keep talking whenever you want. When you're ready, we can come back to your chart, but your safety comes first.`;
