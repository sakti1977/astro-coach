import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Hexagon, Compass, LayoutGrid, Orbit, Lock, Sprout, Target } from "lucide-react";

export const metadata = {
  title: "How We Work — Astro Coach",
  description: "How Astro Coach calculates your chart, why remedies are never upsold, and how to read your results in the voice that works for you.",
};

export default function TrustPage() {
  return (
    <AppShell>
      <div className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-10 text-center">
          <h1 className="text-2xl font-bold text-gray-900">How We Work</h1>
          <p className="text-sm text-gray-500 mt-2">
            What the calculation actually does, why nothing here is ever upsold, and how to read
            your results in whichever voice actually works for you.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
        {/* Calculation rigor */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            The calculation
          </h2>
          <div className="space-y-3">
            {[
              { icon: Hexagon, title: "Swiss Ephemeris (swe)", body: "Planetary longitudes are computed using the Swiss Ephemeris library — the same engine used by professional Jyotish software. It models gravitational interactions to sub-arc-second precision." },
              { icon: Compass, title: "Lahiri Ayanamsha", body: "Vedic astrology uses a sidereal zodiac. The Lahiri ayanamsha (~24°) is subtracted from tropical positions to align planets with their actual constellations — the Government of India's official standard." },
              { icon: LayoutGrid, title: "Whole-sign houses", body: "Each house spans exactly one sign (30°). The ascendant sign becomes house 1, and houses proceed clockwise — the dominant system in classical Jyotish texts." },
              { icon: Orbit, title: "Vimshottari Dasha, verified to the day", body: "Timing is calculated from the Moon's nakshatra at birth across a 120-year cycle. Every Mahadasha, Antardasha, and Pratyantardasha period is checked at calculation time — each level's sub-periods must sum in days exactly to their parent period, with no gaps. If that check ever fails, we refuse to show you a date rather than show you a wrong one." },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-gray-100 rounded-2xl p-5 flex gap-3">
                <item.icon className="w-5 h-5 flex-shrink-0 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* No fear-based upselling */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            Remedies are never upsold
          </h2>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
            <div className="flex gap-3">
              <Lock className="w-5 h-5 flex-shrink-0 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800 text-sm">One deterministic table, not a sales conversation</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Every yoga, dosha, and planetary period in your chart maps to one fixed remedy —
                  mantra, gemstone, dana, vrata, and a behavioral practice — from a table computed
                  once for your exact chart. The coach is instructed to use only what&apos;s already
                  there; it cannot invent a different mantra or gemstone mid-conversation, and it
                  never frames a remedy around urgency or fear of what happens if you don&apos;t act.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Sprout className="w-5 h-5 flex-shrink-0 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800 text-sm">Behavioral practice is never optional</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Every remedy includes a concrete, non-ritual habit alongside any traditional
                  practice — something you can actually do, regardless of whether you want the
                  ritual layer too. You can turn ritual remedies off entirely in Coach and keep
                  everything else.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Target className="w-5 h-5 flex-shrink-0 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800 text-sm">Tendencies, never verdicts</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  The coach is built to never assert a fixed outcome — &ldquo;this will fail,&rdquo;
                  &ldquo;this relationship won&apos;t work.&rdquo; A chart shows tendencies within
                  free will (purushartha), not a sentence. If a response ever reads as fatalistic,
                  that&apos;s a bug, not the design.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Two voices */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            Two ways to read your chart
          </h2>
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              The underlying analysis — the same chart, the same reasoning method, the same remedy
              table — never changes. Only the language does. Switch anytime from the Coach screen.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="border border-purple-100 bg-purple-50/50 rounded-xl p-4">
                <p className="text-sm font-semibold text-purple-800">🕉 Traditional Voice</p>
                <p className="text-xs text-purple-700/80 mt-1.5 leading-relaxed">
                  Full Jyotish vocabulary — karma, dharma, guna, upaya — for anyone fluent or
                  learning the tradition.
                </p>
              </div>
              <div className="border border-sky-100 bg-sky-50/50 rounded-xl p-4">
                <p className="text-sm font-semibold text-sky-800">🎯 Plain Language</p>
                <p className="text-xs text-sky-700/80 mt-1.5 leading-relaxed">
                  The same read in plain psychological and behavioral terms — no mystical framing
                  required to get value, for anyone who wants the insight without the belief system.
                </p>
              </div>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-gray-500">
          Questions about your data? See <Link href="/profile" className="underline hover:text-gray-500">Profile &amp; Settings</Link>.
        </p>
      </div>
    </AppShell>
  );
}
