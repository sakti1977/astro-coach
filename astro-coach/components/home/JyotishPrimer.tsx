import { CircleDot, Clock, Compass, Grid3x3, Layers, Sprout, type LucideIcon } from "lucide-react";

/**
 * "What is Jyotish?" — a short, accurate primer on the Indian system for
 * first-time visitors, and for sceptics who want to know what the chart is
 * actually made of. Static copy: no LLM call, same for everyone.
 */

const PILLARS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Compass,
    title: "A sidereal zodiac",
    body:
      "Jyotish measures the 12 rashis (signs) against the fixed stars rather than the seasons. The gap between the two, the ayanamsha, is now about 24°, which is why your Jyotish sign is often one earlier than your Western one. Jyotish Coach uses the Lahiri ayanamsha, the standard adopted for India's national calendar.",
  },
  {
    icon: CircleDot,
    title: "Nine grahas",
    body:
      "Sun, Moon, Mars, Mercury, Jupiter, Venus and Saturn, plus Rahu and Ketu, the Moon's nodes. Each graha signifies particular areas of life (its karakatva): the Moon the mind, Saturn discipline and endurance, Jupiter wisdom and teachers.",
  },
  {
    icon: Grid3x3,
    title: "Twelve bhavas",
    body:
      "The houses are counted from your lagna, the sign rising in the east at your birth, which is why the exact time and place matter. Each bhava is a domain of life, from self (1st) to career (10th) to release and retreat (12th).",
  },
  {
    icon: Sprout,
    title: "Twenty-seven nakshatras",
    body:
      "The lunar mansions, each 13°20′ of the sky. The nakshatra your Moon occupied at birth colours temperament and, uniquely to Jyotish, sets the starting point of your whole timeline of periods.",
  },
  {
    icon: Clock,
    title: "Dashas: timing",
    body:
      "Vimshottari dasha divides a 120-year cycle into planetary periods, each split into sub-periods (antardasha, pratyantardasha). It is how Jyotish speaks about when a theme becomes active, not only what it is.",
  },
  {
    icon: Layers,
    title: "Vargas and upaya",
    body:
      "Divisional charts refine one area of life: the D9 navamsa for relationships, the D10 for career. Upaya are the remedies. Jyotish Coach leads with practical, behavioural practice; traditional remedies such as mantra are an optional layer.",
  },
];

export default function JyotishPrimer() {
  return (
    <section aria-labelledby="what-is-jyotish" className="mb-12">
      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-center">
        The Indian system
      </p>
      <h2 id="what-is-jyotish" className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mt-2 tracking-tight">
        What is Jyotish?
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-center max-w-xl mx-auto mt-3">
        Jyotish (ज्योतिष, &ldquo;the science of light&rdquo;) is India&apos;s traditional system of astrology and one of the
        six Vedangas, the disciplines that support study of the Vedas. Its methods are set out in classical texts such as
        the <em>Brihat Parashara Hora Shastra</em> and Varahamihira&apos;s <em>Brihat Jataka</em>, and are still practised
        across India today.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <p.icon className="w-3.5 h-3.5" />
              </span>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.title}</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed text-center max-w-xl mx-auto mt-5">
        Jyotish describes tendencies and timing, not a fixed fate. The tradition pairs every reading with
        purushartha, your own effort, and that is where Jyotish Coach puts its attention.
      </p>
    </section>
  );
}
