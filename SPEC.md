# Astro Coach — Product Spec, Competitive Strategy & Roadmap

_Last updated: 2026-07-30. Competitive research current as of this date — re-verify facts before quoting externally; this market moves fast (see §5)._

---

## 0. Product Identity — the non-negotiable North Star

> **Astro Coach is a rational coach.** It forms every assessment from two inputs only: (1) the client's astrological positioning (natal chart, dasha, transits, yogas/doshas) and (2) what the client tells it through chat. It does not defer to fatalism, generic horoscope content, or ritual-first prescriptions. Every resolution or remedy it offers is **practical and behavior/habit-oriented** — things a person can actually do. Ritual remedies (mantra/gemstone/dana/vrata) may be offered as an opt-in layer on top, never as a substitute for the behavioral one, and never invented outside the deterministic remedy table.

**Guardrails (enforced by the `astro-coach-evaluator` subagent alongside `NON_NEGOTIABLES.md`):**
- **G1.** Every coaching output must be traceable to a specific chart placement/dasha/transit AND/OR something the client said in chat. No generic "Cancer people are emotional" filler.
- **G2.** Every remedy surfaced must include a behavioral/habit component. Ritual-only remedies are non-compliant.
- **G3.** The product never asserts deterministic outcomes ("you will fail," "this marriage will not work"). It frames tendencies and offers agency.
- **G4.** New features may add data sources or delivery channels, but may not introduce a second, ungrounded advice pathway.

These four are promoted from this section into `NON_NEGOTIABLES.md` as items 10-13 — see that file for the enforcement mechanics.

---

## 1. Competitive Landscape (India, 2026)

### Market size
India's astrology-app market was **~$163-240M in 2024/25**, projected to **$1.8B by 2030** (MarkNtel, ~49% CAGR) — some estimates run to **$8.8B by 2034**. This is an early, still-consolidating market with a massive tailwind: rising smartphone penetration, Gen Z/millennial adoption, and astrology reframed as a coping mechanism for career/relationship/economic anxiety, not just tradition.

### Tier 1 — Marketplace giants (live human astrologer, pay-per-minute)
- **AstroTalk** — the dominant player. ₹1,176 Cr (~$140M) FY25 revenue, +81% YoY, raising at a **$1.3-1.5B valuation** targeting unicorn status and a 2026 IPO. Model: pay-per-minute calls/chat with a large astrologer pool, celebrity/influencer marketing, plus a growing e-commerce vertical (gemstones, pooja items — ₹140-200 Cr and growing).
- **AstroYogi** — #2, same marketplace model.
- **InstaAstro** — younger-skewing, cleaner UI, but shallower ("fast-food" astrology) — chat-with-astrologer, no real depth or remedy follow-through.

**Documented weaknesses (this is the important part):** independent investigation and widespread user reports describe AstroTalk/AstroYogi's model as running on **fear-based remedy upselling** ("warned of impending misfortune," pushed toward expensive pujas/gemstones), **cold reading** (generic predictions that apply to anyone), **fake/suppressed reviews**, **weak call connections** users are billed for anyway, prices reported at **~7x other platforms**, and **refund stonewalling**. This is not a minor UX gap — it's a structural trust deficit at the market leader, built into how the business monetizes.

### Tier 2 — Calculation-depth / AI-native (the more relevant comparison set for this product)
- **AstroSage / AstroSage AI** — 70M+ downloads, 4.4★, the most calculation-rigorous platform (deep Panchang, KP, Lal Kitab, transits) — "the backbone of digital calculations" in India. **AstroSage AI is India's #1 AI astrology app**, with 20% month-on-month AI-revenue growth for 18 consecutive months — the closest real competitor to this product's AI-chart-coach category. Documented weakness: **outdated, ad-cluttered UI**, appeals mainly to astrology "purists," not newcomers or skeptics.
- **Om.AI** — newer AI-native Vedic astrology app (AI Kundli), smaller, same lane.
- **ClickAstro** — 42-year legacy player, strong in Kerala-style Jyotish, horoscope-report-centric, not conversational/coaching.

### Global reference (not India, but the proof-of-concept for §3 below)
- **Co-Star** ($15M raised) — blunt daily briefings, appeals to already-into-it horoscope fans.
- **The Pattern** (15M users, raising its first round) — explicitly built as an **"anti-astrology app"**: translates chart data into plain psychological/behavioral language with minimal mystical jargon. This is the single most instructive case study here — **it proves a chart-based product can convert people who don't "believe" in astrology**, by changing the language and framing, not the underlying math.

**Nobody in the Indian market has done what The Pattern did.** Every major Indian player (AstroTalk, AstroYogi, AstroSage, InstaAstro) targets people who already believe. That's the gap.

---

## 2. Moat & Differentiation Strategy

Given the research above, four things compound into a real moat — not just a features list:

### 2.1 Trust as direct counter-positioning, not just a nice-to-have
The #1 and #2 players in this market have a *documented, investigated* trust problem: fear-based upselling, cold-reading, fake reviews, no refunds. Astro Coach's existing non-negotiables — a **deterministic remedy table** (no per-conversation improvisation, no upsell surface), **never-fatalistic framing** (G3), and a **transparent "how the chart is calculated" disclosure** — aren't abstract product-quality nice-to-haves. They are a *direct, evidence-backed attack on the market leader's core weakness*. This should be said explicitly in marketing copy and in-app: **"No fear-based remedies. No gemstone upsells. The same chart always gets the same remedy — see exactly how."**

### 2.2 Skeptic-friendly framing — the single biggest open lane in India
The Pattern proved this works and built a 15M-user audience doing it. India's market is currently 100% "believer-first." An app that also lands with the "I don't really believe in this, but this personality read is uncannily accurate" audience is tapping a materially larger addressable market than any competitor is currently pursuing. Astro Coach's coaching identity — karakatva/guna framing translated into legible behavioral patterns, mandatory chain-analysis reasoning (placement → lordship → fusion → dignity → synthesis, not bare assertion), behavior-first remedies — is *already structurally close to this*. See §3 for what's needed to make it real, not just implicit.

### 2.3 Calculation rigor as a provable, not just claimed, differentiator
AstroSage wins on depth but loses on UX and trust signaling (ad-cluttered, purist-oriented). This product just built and shipped (this session) a runtime consistency harness that mathematically guarantees dasha/antardasha/pratyantardasha dates never drift — provable via `python-service/test_dasha.py`, not just asserted. Combined with the new Muhurta module (closing AstroSage's calculation-breadth lead) and a coherent coaching relationship (not just reports), this is "AstroSage-level rigor with none of AstroSage's UX or trust baggage."

### 2.4 Owned distribution: regional panchang audiences
This account already operates `Bangla-Calendar`, `bengali-panchang-bot`, and `Odia-Panchang`. No competitor has this. Funneling those regional audiences into Astro Coach's coaching product is a distribution advantage that can't be replicated without years of the same regional content history.

### 2.5 The long-term, hardest-to-copy moat: outcome-correlated remedy efficacy
Given remedies are free and deterministic (never upsold), Astro Coach is uniquely positioned to do what no competitor — marketplace or AI — is doing: correlate "remedy actually followed" against "outcome reported" over time, and honestly report back what its own data shows works. This requires years of longitudinal, consented user relationships to build — the single hardest thing here for AstroTalk or AstroSage to fast-follow, precisely *because* their business models depend on upselling and one-off transactions rather than a sustained coaching relationship.

### 2.6 What "world-class" actually means here — lessons from The Pattern (15M users)
A deeper review (astrologer-written, not just funding coverage) of The Pattern surfaces something more specific than "translate jargon into plain language" (§3 already covers that). Its **actual** differentiator is writing quality — reviewers repeatedly describe the prose itself, not the feature set, as "eerily accurate." Its own documented weaknesses are just as instructive, because Astro Coach already has structural answers to every one of them — they just aren't packaged to make the contrast obvious yet:

| The Pattern's weakness (per review) | Astro Coach's existing structural answer |
|---|---|
| Black-box opacity — users can't see which placement drove an insight | Chain-analysis method already names the exact placement/house/lordship inline |
| Restrictive à la carte paywall, cost compounds | Deterministic remedy table, never upsold (§2.1) |
| No daily content / refresh cycle | Has the transit data already computed (`transits.py`) — just not surfaced as a lightweight daily touchpoint |
| Potential fatalism from fixed "pattern" framing | G3 — tendencies within free will, never a fixed verdict, already a hard non-negotiable |

Four concrete product changes follow from this, added to §5:
1. **A writing-quality bar in the coaching prompt itself** — not just "be specific," but an explicit few-shot calibration (generic vs. Pattern-quality specific phrasing), the same discipline `coach.ts` already applies to chain-analysis correctness, applied instead to prose craft.
2. **A static, re-readable "Your Foundation" profile** — generated once from the chart (same chain-analysis engine, written as a standalone piece), not gated behind having to prompt for it in chat. This is the artifact people share and re-read, and it directly answers Pattern's "no daily content" gap by being worth returning to.
3. **Named Bond-style categories for Kundli Matching** (queued next in §5.1) — pair the Ashtakoot Guna score with an evocative named category (e.g. soulmate-adjacent / steady / complex / high-friction — final naming TBD, framed via relationship dynamics per G3), not a bare percentage. More memorable, more shareable, avoids the pass/fail trap either way.
4. **A daily chart-grounded transit note** — one or two sentences, generated from the user's own current transits (never a generic horoscope, which would violate G1), surfaced as a notification or home-screen card. Closes Pattern's "no daily refresh" gap without inheriting the genericness that daily-horoscope competitors already lose to.

---

## 3. Non-Believer / Skeptic Positioning — what it actually requires

Being "structurally close" to The Pattern's approach isn't enough; it needs to be a deliberate, testable product surface:

- **A distinct entry framing at onboarding** — let a user opt into "just tell me about myself" framing (personality/behavioral language, chart mentioned as the source but not foregrounded) as an alternative to the full Jyotish-fluent framing (karma/dharma/guna vocabulary), without changing the underlying analysis. Both paths use the *same* chain-analysis and the *same* deterministic remedy table — only the vocabulary layer differs. This is a coaching-system-prompt variant, not a new feature.
- **Front-load a falsifiable claim, not a mystical one, in the first exchange** — e.g., open with a specific, checkable behavioral observation from the chart (the same instinct behind the existing Validation flow) rather than a horoscope-style generality. Accuracy-first framing is what converts skeptics; vague affirmation is what repels them.
- **Make the methodology disclosure prominent, not buried** — the existing "how the chart is calculated" transparency section (Swiss Ephemeris, Lahiri ayanamsha, whole-sign houses, Vimshottari dasha) is already a strong trust signal per the earlier code review; it should be one tap from the coaching screen, not just the landing page.
- **Never require ritual buy-in for value** — already true (Behavioral Only mode exists), but should be the *default framing* for new/skeptic-path users rather than an opt-out toggle they have to discover.

---

## 4. Current Feature Requirements (EARS)

_Verified against code as of commit `1fc5f00`. See git history for anything after this date._

### 4.1 Birth Data Intake & Onboarding
- The system shall collect name, date of birth, time of birth, and place of birth via geocode autocomplete before chart calculation.
- WHEN an unauthenticated user submits birth data, the system shall redirect to `/auth/signin` before proceeding.
- IF a chart already exists THEN the system shall prompt to archive-and-replace, replace-only, or cancel before overwriting.
- WHEN a chart already exists, the home page shall show real, chart-derived highlights (current dasha, Moon placement) instead of the pre-chart sample teaser; the sample teaser shall render only for users with no chart yet (G1).

### 4.2 Chart Calculation
- The system shall compute sidereal (Lahiri) positions for the 9 classical grahas using whole-sign houses, plus D9/D10/D7/D30 divisional charts.
- The system shall detect 8 classical yogas and 3 classical doshas (Manglik, Kaal Sarp, Pitru), each carrying a deterministic remedy.
- The ephemeris service shall require a shared-secret header on every POST endpoint (`NON_NEGOTIABLES.md` #3).

### 4.3 Dasha Timeline
- The system shall compute Vimshottari Mahadasha/Antardasha/Pratyantardasha (3 levels) from the birth Moon's nakshatra.
- The system shall verify internal date-arithmetic consistency at calculation time — every sub-period's days must sum exactly to its parent's span, contiguously, or the calculation shall fail loudly rather than serve inaccurate dates (`NON_NEGOTIABLES.md` #9).
- WHEN the user selects a Mahadasha, the system shall generate an LLM prediction grounded in that period's lord and the natal chart.
- The system shall compute and surface the current Pratyantardasha (not just Mahadasha/Antardasha) as a first-class field, server-side, as the single source of truth alongside `current_maha`/`current_antar`.
- WHEN the user requests a prediction for the currently active Mahadasha, the system shall additionally ground the prompt in the current Antardasha and Pratyantardasha lords — a genuinely differentiating signal, since these are frequently not the same planet as the Mahadasha lord (unlike a historical, since-removed parameter that was always identical to it by construction). Predictions for non-current Mahadashas are unaffected.
- The system shall classify each dasha period's lord by natal dignity (exalted / own-sign / neutral / debilitated, derived mechanically from existing exaltation/own-sign tables) and surface it as a non-fatalistic "operates from strength" / "may ask more deliberate effort" indicator — never a bare verdict (G3). v1 scope: dignity-tier only; moolatrikona, friend/enemy grading, and functional benefic/malefic-by-ascendant are explicitly deferred (would require new classical-table authoring, not mechanically derivable from existing data).

### 4.4 Transits & Muhurta
- The system shall compute current transit positions and detect Sade Sati server-side as the single source of truth.
- The system shall compute panchang (tithi/nakshatra/yoga/karana) and auspicious/inauspicious timing windows (Brahma Muhurta, Abhijit, Rahu Kala, etc.) for any date/place, each paired with practical framing rather than a bare verdict (guardrail G3).

### 4.5 Chart Validation
- The system shall generate 10 age-appropriate yes/no questions and compute an accuracy score, surfaced to the coaching context — informational only, never chart-mutating.

### 4.6 Coaching Chat
- The system shall ground every response in the chart, current dasha/transits, and the user's own input (G1), using a mandatory chain-analysis method.
- The system shall operate in two phases: `gathering` (max ~2-3 exchanges before transitioning — see below) and `recommending`, which itself splits into **plan delivery** (the first recommending turn: one complete, conclusive plan across UPAYA/LIFESTYLE/BEHAVIOR/THOUGHT PROCESS, never ending in a new question) and **follow-up only** (every turn after: answer what's asked, never restate the plan, never solicit a new topic).
- The system shall let the user skip discovery entirely via a "Get My Plan Now" action.
- WHERE the user has enabled Vedic Remedies mode, ritual remedies shall be included alongside behavioral guidance; WHERE disabled, only behavioral guidance shall be shown — never gemstones/mantras/fasting in that mode.
- The system shall never invent a remedy, placement, or life detail not present in the chart data or the conversation (G1, G2).

### 4.7 Habits, Goals, Auth/Sync, Notifications, Platform
- Unchanged from prior verification — see `NON_NEGOTIABLES.md` #1, #6, #7, #8 for the trust/security invariants covering these areas (cloud sync integrity, rate limiting, input validation, secrets hygiene).

---

## 5. Future Scope — Prioritized Against the Competitive Research

Re-verify market facts in §1 before acting on stale versions of this section — funding rounds, valuations, and feature parity all move fast in this space.

### 5.1 Near-term (0-3 months) — close known gaps, build the trust-attack surface
1. ~~**Skeptic-mode onboarding + methodology-disclosure surfacing** (§3)~~ — **shipped**: `tonePreference` toggle + `/trust` page.
2. ~~**A "Trust & Methodology" page**~~ — **shipped** alongside #1.
3. ~~**A writing-quality bar in the coaching prompt**~~ — **shipped**: few-shot calibration in `coach.ts`.
4. ~~**A static, re-readable "Your Foundation" profile page**~~ — **shipped**: `/foundation`, reusing `buildCoachSystemPrompt` wholesale (NON_NEGOTIABLES.md #13) with a new task instruction (`buildFoundationTask`), generated once via Sonnet and cached on the profile, with Regenerate/Copy affordances. A natural source for the future "shareable report card" (#10).
5. **A daily chart-grounded transit note** (§2.6) — one or two sentences from the user's own current transits (`transits.py` already computes this), surfaced as a notification/home-card. Never a generic horoscope — violates G1 if it isn't chart-specific.
6. **Kundli Matching (Ashtakoot Guna Milan)** — confirmed table-stakes: AstroYogi and AstroSage Kundli (70M downloads) both lead with this. Pair the Guna score with a named Bond-style category (§2.6 #3), not a bare percentage — frame via relationship dynamics, never pass/fail (G3).
7. **WhatsApp coaching channel** — lowest-friction acquisition surface in India; none of the researched competitors were found offering a WhatsApp-native flow.

### 5.2 Mid-term (3-9 months)
8. **Family chart linking** — household retention multiplier.
9. **Personalized festival/vrata calendar** and **regional panchang integration** (§2.4) — genuine owned-distribution advantage.
10. **Shareable chart "report card"** — low-friction viral acquisition loop; the "Your Foundation" profile (#4) is a natural source for this.
11. **Exam/career-cycle timing coach** mapped to Indian competitive-exam calendars — an India-specific angle no researched competitor (including global reference apps) addresses.

### 5.3 Long-term / defensibility (9+ months)
12. **Outcome-correlated remedy efficacy** (§2.5) — the core, hardest-to-copy moat. Requires evolving the one-time Validation quiz into a periodic check-in.
13. **Optional human-astrologer escalation** — strictly supplementary (G4), never replacing the chart+chat-grounded core; only relevant if user research shows real demand for it despite the trust-positioning strategy above.

### 5.4 Candidates (pending approval — per §6 process)

Source: external product-strategy critique, 2026-07-31. Logged here per §6 rather than acted on directly; each already passes a G1-G4 check below, but still needs explicit approval before promotion into §5.1-5.3.

14. **Candidate — Surface skeptic-mode framing as a pre-onboarding product moment, not a buried settings toggle.** Today `tonePreference` only becomes visible on the Coach screen, after a user has already entered a Jyotish-fluent chart flow — the audience §2.2/§3 name as the single biggest open lane (The Pattern's 15M users) never encounters it. Candidate: a landing-page-level choice ("I don't really believe in this — just show me the personality read") before/alongside chart entry, using the *same* underlying `tonePreference` mechanism that already exists. G1-G4: passes — no new reasoning path, just earlier exposure of the existing one (G4 satisfied by construction).
15. **Candidate — Close the loop between Coach-delivered plans and the Habits tracker.** The coach generates behavioral recommendations (`buildCoachSystemPrompt`'s plan-delivery turn); `/habits` tracks goals/streaks independently. Neither currently reads the other — the coach's `goals` context isn't populated from `/habits`' `Goal[]`, and habit completion doesn't feed back into later coaching turns. Candidate: pass the user's actual habits/goals into the coaching prompt context, and let a plan's action items optionally become trackable habits. G1-G4: passes — this is richer grounding in already-real user data (strengthens G1), not a new advice pathway.
16. **Candidate — Weave the chart-validation flow into the primary onboarding narrative instead of a separate, unlinked route.** `/validate`'s yes/no accuracy-calibration mechanic (SPEC §1) is arguably the single most differentiated trust-building feature in the product — nothing comparable exists at AstroTalk/AstroYogi/AstroSage — but it's not linked from the home page's primary CTAs, the chart page, or the coach page. Candidate: sequence it as a named step in the primary flow ("chart → does this match your life? → the read that survives validation is the one you keep") rather than a side quest. G1-G4: passes — resequences an existing, already-compliant flow; adds no new reasoning.

---

## 6. Weekly Scope-Review Process

- The system's scope shall be reviewed weekly. A review (human or scheduled research agent) shall survey recent developments in the astrology-app space — competitor feature launches, funding/positioning shifts, and India-specific market signals — and shall propose at most 3 candidate scope additions, appended to §5 under a "Candidate" marker rather than merged directly.
- IF a candidate fails any of guardrails G1-G4 (§0) THEN it shall be rejected and logged with the reason, regardless of competitive pressure to match a competitor's feature.
- IF a candidate passes G1-G4 THEN it still requires explicit human approval before promotion from "Candidate" to an accepted item in §5.
- This process, and all resulting scope, is subject to the same `NON_NEGOTIABLES.md` gate as every other change to this codebase.

---

## 7. UI/UX Audit (2026-07-30)

Method note: done as a code-level read of every page's Tailwind/JSX (no live browser access in the environment this was written in — no screenshots were taken). Re-verify visually before treating any finding here as settled; code-level review can miss things only visible when rendered (spacing rhythm at real breakpoints, actual color contrast, real font rendering).

### 7.1 Cross-cutting findings (affect every page at once)

1. **No real typeface is actually loaded.** `globals.css` hardcodes `body { font-family: Arial, Helvetica, sans-serif; }`, which overrides a `--font-geist-sans` CSS variable in `@theme inline` that is never set anywhere — `layout.tsx` has no `next/font` import at all. Every visitor sees their OS's default Arial/Helvetica. Every comparable app (Linear, Notion, Co-Star, The Pattern, Vercel-adjacent products generally) deliberately picks a typeface; this is the single highest-ROI fix in this whole review — one `next/font` import plus deleting one CSS line touches every page at once.
2. **No dark mode**, despite `prefers-color-scheme` variables being declared and then unused everywhere else (every page hardcodes `bg-white`/`text-gray-900` with no `dark:` variants). Astrology/coaching content gets real evening usage — it's literally when Co-Star/The Pattern users check in. A real gap versus "world-class."
3. **Icons are unicode/emoji glyphs** (✦ ◎ ⬡ ◐ ✕ ✓ 🔒 🕉 🎯…) throughout, despite `lucide-react` already being an installed, unused dependency. Emoji render inconsistently across OS/browser (Windows Segoe UI Emoji vs. Apple's set vs. Android's look visibly different), which undercuts the "designed" feel the rest of the layout is going for. Swapping to a consistent SVG icon set is a Nielsen consistency-and-standards fix, not a redesign.
4. **Color palette is 100% stock Tailwind indigo/violet/gray** — clean and inoffensive, but generic. It doesn't yet have a distinctive identity the way Co-Star (stark mono + neon accent) or The Pattern (soft warm gradients) do, despite indigo/violet being thematically reasonable for astrology already. There's room to push further (a signature gradient, restrained celestial texture) without abandoning the current palette.
5. **One brand-consistency slip**: `YesNoQuestion.tsx` uses near-black (`gray-900`) for its primary "Yes" button and progress bar instead of the indigo-600 used as the primary action color everywhere else in the app.
6. **Light-mode text/input contrast bug (fixed this pass, distinct from #2).** `globals.css`'s `prefers-color-scheme: dark` media query flips `--foreground` to near-white with zero `dark:` Tailwind variants anywhere in the app, so under an OS/browser set to dark mode, unstyled inputs/text inherit near-invisible near-white text inside hardcoded white containers — this is what was reported as date/time/place text being hard to read. Fixed via `color-scheme: light` (forces native form-control chrome to stay light) plus explicit text colors on form inputs, and a contrast bump on the worst-offending `text-gray-300`/`text-gray-400` secondary-text instances (both fail WCAG AA on white) — NOT full dark mode, which remains Tier 2 item #2 below, not done.

### 7.2 Page-by-page notes

- **Chart** (`app/chart/page.tsx`) — well-composed (consistent `rounded-2xl` card system, clear hierarchy via uppercase micro-labels), but `HOUSE_COLORS` assigns 12 different arbitrary hues to house badges with no semantic grouping — reads as busier than the otherwise disciplined 1-2 color primary palette. Consider collapsing to 2-3 semantic groups (e.g. kendra/trikona/dusthana) or a single accent + neutral treatment.
- **Habits** — same quality bar as Chart; 3-column grid (radar+goals sidebar, tracker main) is a sound layout.
- **Profile/Settings** (`app/profile/page.tsx`) — noticeably flatter than Chart/Habits: a long vertical stack of undifferentiated white boxes, text-only section headers, no icons, no visual hierarchy variety. Reads like an afterthought next to the more visually considered data pages. Worth bringing to the same bar — icons per section at minimum; a left-side settings nav instead of one long scroll if the section count keeps growing.
- **Validate** (`YesNoQuestion.tsx`) — actually one of the better-designed flows: real progress bar, clean card-based Yes/No with `active:scale-95` micro-interaction. Only issue is the color inconsistency noted above.
- **Auth/Sign-in** — well done: centered card, tab switcher, `shadow-xl`, gradient background, privacy note under the fold. Matches modern SaaS auth-page conventions (Linear/Vercel-style) already.
- **Muhurta / Trust** (this session's additions) — built against the same design system as Chart/Habits, so they inherit both its strengths and the cross-cutting gaps above (no dark mode, emoji icons).

### 7.3 Prioritized recommendations

**Tier 1 — cheap, universal, high leverage:** — **shipped**
1. ~~Load a real typeface~~ — the `geist` package (official Vercel typeface, matching the CSS variable name that was already half-wired) is now loaded via `next/font` in `layout.tsx`; the Arial override in `globals.css` is gone.
2. ~~Replace decorative unicode/emoji glyphs with `lucide-react` icons~~ — done app-wide (17 files). Meaningful glyphs were deliberately kept: classical planet symbols (☉☽♂…), the 🕉 Om symbol (no icon equivalent, paired with 🎯 for visual parity in the two tone-preference toggles), country flags, and simple bullet dots.
3. ~~Fix `YesNoQuestion.tsx`'s color to indigo-600~~ — done, plus the same `gray-900` inconsistency found and fixed in `auth/error/page.tsx`'s CTA button during the sweep.
4. ~~Fix light-mode text/input contrast bug~~ — `color-scheme: light` forced globally, explicit `text-gray-900` added to form inputs lacking a text color, worst-offending `text-gray-300`/`text-gray-400` secondary-text instances bumped to `text-gray-500`/`600` for WCAG AA. Full dark mode is still Tier 2 item #2 above, not done.

**Tier 2 — moderate effort, meaningful differentiation:**
4. Dark mode via Tailwind `dark:` variants across the existing color usage.
5. Bring Profile/Settings up to the visual bar of Chart/Habits (icons, hierarchy, possibly a section nav).
6. Rationalize the 12-color house-badge rainbow on Chart into a smaller, semantic palette.

**Tier 3 — bigger investment, brand-level differentiation:**
7. A more distinctive visual identity beyond stock Tailwind indigo — a signature gradient or restrained celestial texture, considered rather than decorative.
8. A real mobile-breakpoint pass once live browser/device testing is available — this review could reason about responsive grid classes but not verify actual touch-target sizing or spacing rhythm at 375px.
