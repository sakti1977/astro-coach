/**
 * "Your Foundation" — a generated-once, re-readable personality profile.
 *
 * SPEC.md §2.6: The Pattern's actual differentiator is writing quality, and its
 * biggest gap is having nothing worth returning to between chat sessions. This
 * closes that gap — but per NON_NEGOTIABLES.md #13 (no second, ungrounded advice
 * pathway), it must NOT become a separate, independently-maintained analysis
 * path. It reuses buildCoachSystemPrompt wholesale (same chart grounding, same
 * mandatory chain-analysis method, same deterministic remedy data, same
 * writing-quality bar, same tonePreference support) and only adds a
 * task-specific instruction for what to produce instead of a chat turn.
 */

export function buildFoundationTask(): string {
  return `TASK — WRITE "YOUR FOUNDATION":
This is NOT a chat turn. Do not ask a question. Do not wait for a response, and do not address
the reader as if mid-conversation. Write one complete, standalone piece — the kind of thing
someone reads once and comes back to later, the way a genuinely good personality read earns a
second look. It should read as continuous, considered prose, not a checklist or a form.

Cover these five threads, in this order, each its own short section with a plain, understated
heading (no "STEP 1" scaffolding — just a natural label like "Core Nature"):

1. CORE NATURE — grounded in the Ascendant (Lagna) and Sun: their fundamental orientation to
   life, how they tend to show up, what people notice about them first.
2. INNER WORLD — grounded in the Moon and its nakshatra: emotional patterns, what actually
   makes them feel steady or unsettled, the layer under the surface.
3. WHAT'S ACTIVE RIGHT NOW — grounded in the current Mahadasha/Antardasha lord and its
   placement: the specific theme this period of their life is asking of them, not a generic
   "life stage" description.
4. NATURAL STRENGTHS — grounded in the best-dignified planet(s) and any beneficial yogas
   present: what comes easily to them, described specifically, not as generic flattery.
5. WHERE THE FRICTION LIVES — grounded in the most afflicted placement or dosha present: a
   real growth edge, framed as a pattern to work with (purushartha), never a flaw or a fixed
   verdict. Pair it with the ONE most relevant behavioral practice from the deterministic
   remedy data already provided — not a generic suggestion invented for this piece.

Every claim must trace to an actual placement, exactly as the mandatory chain-analysis method
and the writing-quality bar above require — this document is held to the exact same grounding
and prose standard as a coaching response, it's just longer and unprompted. Close with one or
two sentences that connect the threads — a synthesis, not a summary restating what was said.

Length: substantial but not exhausting — something a person can read in under three minutes.`;
}
