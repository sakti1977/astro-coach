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

### 4.2 Chart Calculation
- The system shall compute sidereal (Lahiri) positions for the 9 classical grahas using whole-sign houses, plus D9/D10/D7/D30 divisional charts.
- The system shall detect 8 classical yogas and 3 classical doshas (Manglik, Kaal Sarp, Pitru), each carrying a deterministic remedy.
- The ephemeris service shall require a shared-secret header on every POST endpoint (`NON_NEGOTIABLES.md` #3).

### 4.3 Dasha Timeline
- The system shall compute Vimshottari Mahadasha/Antardasha/Pratyantardasha (3 levels) from the birth Moon's nakshatra.
- The system shall verify internal date-arithmetic consistency at calculation time — every sub-period's days must sum exactly to its parent's span, contiguously, or the calculation shall fail loudly rather than serve inaccurate dates (`NON_NEGOTIABLES.md` #9).
- WHEN the user selects a Mahadasha, the system shall generate an LLM prediction grounded in that period's lord and the natal chart.

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
1. **Skeptic-mode onboarding + methodology-disclosure surfacing** (§3) — the single highest-leverage, lowest-engineering-cost item here. Mostly prompt/copy/IA work, not new calculation surface.
2. **A "Trust & Methodology" page** making the deterministic-remedy-table and no-upsell stance explicit and comparison-aware (without naming competitors) — directly counter-positions against §1's documented AstroTalk/AstroYogi weaknesses.
3. **Kundli Matching (Ashtakoot Guna Milan)** — confirmed as table-stakes: AstroYogi and AstroSage Kundli (70M downloads) both lead with this as a headline feature. Frame results as relationship-dynamics coaching, never pass/fail (G3).
4. **WhatsApp coaching channel** — lowest-friction acquisition surface in India; none of the researched competitors were found offering a WhatsApp-native flow.

### 5.2 Mid-term (3-9 months)
5. **Family chart linking** — household retention multiplier.
6. **Personalized festival/vrata calendar** and **regional panchang integration** (§2.4) — genuine owned-distribution advantage.
7. **Shareable chart "report card"** — low-friction viral acquisition loop.
8. **Exam/career-cycle timing coach** mapped to Indian competitive-exam calendars — an India-specific angle no researched competitor (including global reference apps) addresses.

### 5.3 Long-term / defensibility (9+ months)
9. **Outcome-correlated remedy efficacy** (§2.5) — the core, hardest-to-copy moat. Requires evolving the one-time Validation quiz into a periodic check-in.
10. **Optional human-astrologer escalation** — strictly supplementary (G4), never replacing the chart+chat-grounded core; only relevant if user research shows real demand for it despite the trust-positioning strategy above.

---

## 6. Weekly Scope-Review Process

- The system's scope shall be reviewed weekly. A review (human or scheduled research agent) shall survey recent developments in the astrology-app space — competitor feature launches, funding/positioning shifts, and India-specific market signals — and shall propose at most 3 candidate scope additions, appended to §5 under a "Candidate" marker rather than merged directly.
- IF a candidate fails any of guardrails G1-G4 (§0) THEN it shall be rejected and logged with the reason, regardless of competitive pressure to match a competitor's feature.
- IF a candidate passes G1-G4 THEN it still requires explicit human approval before promotion from "Candidate" to an accepted item in §5.
- This process, and all resulting scope, is subject to the same `NON_NEGOTIABLES.md` gate as every other change to this codebase.
