"use client";

import ProtectedRoute from "@/components/ProtectedRoute";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getProfile, type UserProfile } from "@/lib/profile";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";

interface TransitPlanet {
  sign: string;
  sign_num: number;
  degree: number;
  abs_pos: number;
  house: number;
  retrograde: boolean;
  house_from_natal_lagna: number;
}

interface TransitData {
  planets: Record<string, TransitPlanet>;
  calculated_at: string;
}

// Brief interpretive keywords for transit house positions
const HOUSE_THEMES: Record<number, string> = {
  1:  "Self, body, identity — highly personal",
  2:  "Finances, speech, family",
  3:  "Courage, siblings, short travel, communication",
  4:  "Home, mother, inner peace",
  5:  "Creativity, children, romance, intellect",
  6:  "Health, enemies, daily work",
  7:  "Partnerships, spouse, public dealings",
  8:  "Transformation, sudden events, longevity",
  9:  "Fortune, dharma, father, higher learning",
  10: "Career, reputation, authority, public life",
  11: "Gains, friends, ambitions, income",
  12: "Losses, isolation, foreign lands, liberation",
};

function houseSuffix(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export default function TransitsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transits, setTransits] = useState<TransitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = getProfile();
    if (!p.chart) { router.push("/"); return; }
    setProfile(p);
    fetchTransits(p.chart.ascendant.sign_num, p.birthData?.timezone ?? "UTC");
  }, [router]);

  async function fetchTransits(natalAscSignNum: number, tzStr: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/transits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ natal_asc_sign_num: natalAscSignNum, tz_str: tzStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transit fetch failed");
      setTransits(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load transits");
    } finally {
      setLoading(false);
    }
  }

  if (!profile?.chart) return null;

  const calcTime = transits?.calculated_at
    ? new Date(transits.calculated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white">
      <NavBar />
      <div className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Current Transits</h1>
            <p className="text-sm text-gray-400 mt-1">
              Gochar — planetary positions today relative to your natal chart
            </p>
            {calcTime && (
              <p className="text-xs text-gray-300 mt-0.5">Calculated at {calcTime}</p>
            )}
          </div>
          <button
            onClick={() => fetchTransits(profile.chart!.ascendant.sign_num, profile.birthData?.timezone ?? "UTC")}
            disabled={loading}
            className="text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-40 transition-colors font-medium"
          >
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8">

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {loading && !transits && (
          <div className="text-center py-20">
            <p className="text-3xl animate-pulse mb-3">◉</p>
            <p className="text-gray-400 text-sm">Calculating planetary positions…</p>
          </div>
        )}

        {transits && (
          <div className="space-y-3">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-400 pb-1 border-b border-gray-100">
              <span className="font-medium text-gray-600">Planet</span>
              <span className="ml-auto">Transit Sign</span>
              <span className="w-20 text-center">House</span>
              <span className="w-28 hidden sm:block">Theme</span>
            </div>

            {Object.entries(transits.planets).map(([key, tp]) => {
              const meta = PLANET_META[key as PlanetKey];
              if (!meta) return null;
              const natal = profile.chart!.planets[key];
              const h = tp.house_from_natal_lagna;
              const sameSign = natal && tp.sign_num === natal.sign_num;
              const isKeyHouse = [1, 4, 7, 10].includes(h); // kendra houses — stronger

              return (
                <div
                  key={key}
                  className={`rounded-xl border p-4 transition-all ${isKeyHouse ? "border-indigo-100 bg-indigo-50/50" : "border-gray-100 bg-white"}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Planet */}
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <span className="text-xl">{meta.symbol}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                        {tp.retrograde && (
                          <p className="text-xs text-gray-400">Retrograde ®</p>
                        )}
                      </div>
                    </div>

                    {/* Arrow from natal to transit */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {natal && (
                        <span className="text-xs text-gray-400 hidden sm:block flex-shrink-0">
                          {SIGN_NAMES[natal.sign_num].slice(0, 3)} →
                        </span>
                      )}
                      <span className={`text-sm font-medium ${sameSign ? "text-blue-700" : "text-gray-900"}`}>
                        {SIGN_NAMES[tp.sign_num]}
                      </span>
                      <span className="text-xs text-gray-400">{tp.degree.toFixed(1)}°</span>
                      {sameSign && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          natal sign
                        </span>
                      )}
                    </div>

                    {/* House badge */}
                    <div className={`flex-shrink-0 w-12 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      isKeyHouse ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                      {houseSuffix(h)}
                    </div>
                  </div>

                  {/* Theme */}
                  <p className="text-xs text-gray-400 mt-2 ml-1">
                    <span className="font-medium text-gray-500">{meta.label} in {houseSuffix(h)} house —</span>{" "}
                    {HOUSE_THEMES[h]}
                  </p>
                </div>
              );
            })}

            {/* Natal lagna reference */}
            <div className="mt-4 border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
              <span className="font-medium text-gray-700">Natal Lagna:</span>{" "}
              {SIGN_NAMES[profile.chart.ascendant.sign_num]} · Houses counted from {SIGN_NAMES[profile.chart.ascendant.sign_num]} as 1st
              <span className="ml-3 text-gray-400">· Kendra (1/4/7/10) transits highlighted</span>
            </div>
          </div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
