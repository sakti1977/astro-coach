"use client";

import ProtectedRoute from "@/components/ProtectedRoute";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import ChartToggle from "@/components/chart/ChartToggle";
import { getProfile, type UserProfile } from "@/lib/profile";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";

// Color palette for houses
const HOUSE_COLORS: Record<number, string> = {
  1: "bg-indigo-50 text-indigo-700",
  2: "bg-violet-50 text-violet-700",
  3: "bg-blue-50 text-blue-700",
  4: "bg-cyan-50 text-cyan-700",
  5: "bg-teal-50 text-teal-700",
  6: "bg-green-50 text-green-700",
  7: "bg-yellow-50 text-yellow-700",
  8: "bg-orange-50 text-orange-700",
  9: "bg-rose-50 text-rose-700",
  10: "bg-pink-50 text-pink-700",
  11: "bg-purple-50 text-purple-700",
  12: "bg-slate-50 text-slate-700",
};

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
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading your chart…</p>
        </div>
      </div>
    );
  }

  const { chart, dashas, birthData } = profile;

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white">
      <NavBar />

      {/* Page header */}
      <div className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {birthData?.name}&apos;s Birth Chart
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                {birthData?.date} &middot; {birthData?.time} &middot; {birthData?.city}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
                <span>⬡</span> {SIGN_NAMES[chart.ascendant.sign_num]} Lagna
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart display */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <ChartToggle chart={chart} />
          </div>

          {/* Chart summary */}
          <div className="space-y-4">
            {/* Key stats row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Ascendant */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Ascendant</p>
                <p className="text-lg font-bold text-gray-900">{SIGN_NAMES[chart.ascendant.sign_num]}</p>
                <p className="text-xs text-gray-400 mt-0.5">{chart.ascendant.degree.toFixed(1)}° · House 1</p>
              </div>

              {/* Moon nakshatra */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Nakshatra</p>
                <p className="text-lg font-bold text-gray-900">{chart.moon_nakshatra.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Pada {chart.moon_nakshatra.pada} · {chart.moon_nakshatra.lord}</p>
              </div>
            </div>

            {/* Current dasha */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-3">Current Dasha Period</p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm border border-indigo-100 text-2xl">
                  {PLANET_META[dashas.current_maha.toLowerCase() as PlanetKey]?.symbol}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">
                    {dashas.current_maha} / {dashas.current_antar}
                  </p>
                  <p className="text-xs text-indigo-500 mt-0.5">
                    Ends {new Date(dashas.current_maha_end).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            </div>

            {/* Planetary positions */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Planetary Positions</p>
              <div className="space-y-2.5">
                {Object.entries(chart.planets).map(([key, p]) => {
                  const meta = PLANET_META[key as PlanetKey];
                  if (!meta) return null;
                  const houseColor = HOUSE_COLORS[p.house] ?? "bg-gray-50 text-gray-600";
                  return (
                    <div key={key} className="flex items-center justify-between text-sm group">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center text-sm group-hover:bg-indigo-50 transition-colors">
                          {meta.symbol}
                        </span>
                        <span className="font-medium text-gray-700">{meta.label}</span>
                        {p.retrograde && (
                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md">®</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{SIGN_NAMES[p.sign_num]}</span>
                        <span className="text-gray-200">·</span>
                        <span>{p.degree.toFixed(1)}°</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${houseColor}`}>
                          H{p.house}
                        </span>
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
                className="flex-1 border border-indigo-200 text-indigo-700 bg-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors"
              >
                Validate Chart →
              </button>
              <button
                onClick={() => router.push("/coach")}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
              >
                Talk to Coach →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
