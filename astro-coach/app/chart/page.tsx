"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import ChartToggle from "@/components/chart/ChartToggle";
import { getProfile, type UserProfile } from "@/lib/profile";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";

export default function ChartPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const p = getProfile();
    if (!p.chart) { router.push("/"); return; }
    setProfile(p);
  }, [router]);

  if (!profile?.chart || !profile?.dashas) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading chart...</p>
      </div>
    );
  }

  const { chart, dashas, birthData } = profile;

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{birthData?.name}&apos;s Birth Chart</h1>
          <p className="text-sm text-gray-400 mt-1">
            {birthData?.date} · {birthData?.time} · {birthData?.city} · {SIGN_NAMES[chart.ascendant.sign_num]} Lagna
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart display */}
          <div>
            <ChartToggle chart={chart} />
          </div>

          {/* Chart summary */}
          <div className="space-y-6">
            {/* Ascendant */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase mb-3">Ascendant (Lagna)</p>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xl font-bold text-gray-900">{SIGN_NAMES[chart.ascendant.sign_num]}</p>
                  <p className="text-sm text-gray-500">{chart.ascendant.degree.toFixed(1)}° · House 1</p>
                </div>
              </div>
            </div>

            {/* Moon nakshatra */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase mb-3">Moon Nakshatra</p>
              <p className="text-xl font-bold text-gray-900">{chart.moon_nakshatra.name}</p>
              <p className="text-sm text-gray-500">
                Pada {chart.moon_nakshatra.pada} · Lord: {chart.moon_nakshatra.lord}
              </p>
            </div>

            {/* Current dasha */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase mb-3">Current Period</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{PLANET_META[dashas.current_maha.toLowerCase() as PlanetKey]?.symbol}</span>
                <div>
                  <p className="font-semibold text-gray-900">
                    {dashas.current_maha} / {dashas.current_antar}
                  </p>
                  <p className="text-xs text-gray-400">
                    Maha ends {new Date(dashas.current_maha_end).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            </div>

            {/* All planets */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase mb-3">Planetary Positions</p>
              <div className="space-y-2">
                {Object.entries(chart.planets).map(([key, p]) => {
                  const meta = PLANET_META[key as PlanetKey];
                  if (!meta) return null;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-base">{meta.symbol}</span>
                        <span className="font-medium text-gray-700">{meta.label}</span>
                        {p.retrograde && <span className="text-xs text-gray-400">®</span>}
                      </div>
                      <div className="text-right text-gray-500">
                        <span>{SIGN_NAMES[p.sign_num]}</span>
                        <span className="text-gray-300 mx-1">·</span>
                        <span>{p.degree.toFixed(1)}°</span>
                        <span className="text-gray-300 mx-1">·</span>
                        <span>H{p.house}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/validate")}
                className="flex-1 border border-gray-900 text-gray-900 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Validate Chart →
              </button>
              <button
                onClick={() => router.push("/coach")}
                className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Talk to Coach →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
