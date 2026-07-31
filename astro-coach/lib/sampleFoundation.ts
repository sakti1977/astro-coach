import type { CoachTonePreference } from "@/lib/profile";

/**
 * Static, hand-authored sample "Foundation"-style excerpt shown on the home
 * page before a visitor has a real chart — a taste of the writing quality,
 * not a live LLM call (no cost/abuse surface, matches the writing-quality
 * bar in buildFoundationTask). Fictional placements, always labeled SAMPLE.
 */
export const SAMPLE_FOUNDATION: Record<CoachTonePreference, string[]> = {
  jyotish: [
    "Sun in the tenth house, ruling Leo, makes career something closer to identity than income — the kind of chart where public standing quietly matters more than the person usually admits, and where leadership only feels right when the authority behind it is real, not just the title.",
    "The Moon sits in Rohini, in the fourth house — Rohini's whole nature is beauty, stability, and a deep, almost stubborn attachment to comfort, so this isn't someone who's simply ‘sentimental about home.’ An unsettled living space genuinely destabilizes them, the way it wouldn't for most people.",
    "Right now, they're moving through a Jupiter Mahadasha — Jupiter's own long cycle of expansion, the kind of period that rewards teaching, studying, or building something meant to outlast the moment, not chasing what's merely urgent.",
  ],
  skeptic: [
    "Career isn't just a paycheck for this person — it's tied up with identity, so public recognition matters more to them than they'd usually admit, and they only feel comfortable leading when the authority is genuinely theirs, not just a title.",
    "Emotionally, their stability is deeply tied to their physical environment — not as a preference, but closer to a real need; an unsettled home life genuinely throws them off in a way it wouldn't for most people.",
    "And right now they're in an extended growth phase — a period that rewards teaching, studying, or building something meant to last, rather than reacting to whatever feels urgent this week.",
  ],
};
