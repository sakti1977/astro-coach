"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ChartToggle from "@/components/chart/ChartToggle";
import { getProfile, saveProfile, type UserProfile } from "@/lib/profile";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";
import { Hexagon, Download, Trash2 } from "lucide-react";

// Color palette for houses
/**
 * House badges grouped by classical house type rather than 12 unrelated hues:
 * kendra (angular pillars), trikona (fortune), dusthana (difficulty — framed as
 * where effort is asked, never as "bad"), and the remaining houses.
 */
const HOUSE_GROUPS = [
  { key: "kendra", dot: "bg-indigo-500", label: "Kendra 1·4·7·10", houses: [1, 4, 7, 10], badge: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300" },
  { key: "trikona", dot: "bg-emerald-500", label: "Trikona 5·9", houses: [5, 9], badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" },
  { key: "dusthana", dot: "bg-amber-500", label: "Dusthana 6·8·12", houses: [6, 8, 12], badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200" },
  { key: "other", dot: "bg-gray-400", label: "2·3·11", houses: [2, 3, 11], badge: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" },
] as const;

const HOUSE_COLORS: Record<number, string> = Object.fromEntries(
  HOUSE_GROUPS.flatMap((g) => g.houses.map((h) => [h, g.badge]))
);

export default function ChartPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const p = getProfile();
    if (!p.chart) { router.push("/"); return; }
    queueMicrotask(() => setProfile(p));
  }, [router]);

  function exportProfile() {
    const p = getProfile();
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jyotish-coach-${p.birthData?.name?.replace(/\s+/g, "-") ?? "profile"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetChart() {
    if (!confirm("This will clear your chart and all coaching data. Are you sure?")) return;
    saveProfile({
      birthData: null, chart: null, dashas: null,
      validation: { questions: [], accuracyScore: 0, confirmedThemes: [], isValidated: false },
      goals: [], habits: [], chatHistory: [],
      coaching: { behaviorProfile: [], lastUpdated: new Date().toISOString(), phase: "gathering", exchangeCount: 0, planDelivered: false, tonePreference: "jyotish", includeReligiousSolutions: false, preferredLanguage: "en-IN" },
    });
    router.push("/");
  }

  if (!profile?.chart || !profile?.dashas) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 dark:from-indigo-950/40 to-white dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading your chart…</p>
        </div>
      </div>
    );
  }

  const { chart, dashas, birthData } = profile;

  return (
    <AppShell>
      {/* Page header */}
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {birthData?.name}&apos;s Birth Chart
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {birthData?.date} &middot; {birthData?.time} &middot; {birthData?.city}
              </p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold">
                <Hexagon className="w-3.5 h-3.5" /> {SIGN_NAMES[chart.ascendant.sign_num]} Lagna
              </span>
              <Link href="/profile" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Edit birth data →</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart display */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <ChartToggle chart={chart} />
          </div>

          {/* Chart summary */}
          <div className="space-y-4">
            {/* Key stats row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Ascendant */}
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Ascendant</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{SIGN_NAMES[chart.ascendant.sign_num]}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{chart.ascendant.degree.toFixed(1)}° · House 1</p>
              </div>

              {/* Moon nakshatra */}
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Nakshatra</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{chart.moon_nakshatra.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pada {chart.moon_nakshatra.pada} · {chart.moon_nakshatra.lord}</p>
              </div>
            </div>

            {/* Current dasha */}
            <div className="bg-gradient-to-r from-indigo-50 dark:from-indigo-950/40 to-violet-50 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-3">Current Dasha Period</p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center shadow-sm border border-indigo-100 dark:border-indigo-900/60 text-2xl">
                  {PLANET_META[dashas.current_maha.toLowerCase() as PlanetKey]?.symbol}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100 text-base">
                    {dashas.current_maha} / {dashas.current_antar}
                  </p>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                    Ends {new Date(dashas.current_maha_end).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            </div>

            {/* Planetary positions */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Planetary Positions</p>
              <div className="space-y-2.5">
                {Object.entries(chart.planets).map(([key, p]) => {
                  const meta = PLANET_META[key as PlanetKey];
                  if (!meta) return null;
                  const houseColor = HOUSE_COLORS[p.house] ?? "bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400";
                  return (
                    <div key={key} className="flex items-center justify-between text-sm group">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex items-center justify-center text-sm group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition-colors">
                          {meta.symbol}
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{meta.label}</span>
                        {p.retrograde && (
                          <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md">®</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{SIGN_NAMES[p.sign_num]}</span>
                        <span className="text-gray-200 dark:text-gray-700">·</span>
                        <span>{p.degree.toFixed(1)}°</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${houseColor}`}>
                          H{p.house}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-x-3 gap-y-1.5">
                {HOUSE_GROUPS.map((g) => (
                  <span key={g.key} className="inline-flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                    <span className={`inline-block w-2 h-2 rounded-full ${g.dot}`} />
                    {g.label}
                  </span>
                ))}
              </div>
            </div>

            {!profile.validation?.isValidated && (
              <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-4 text-sm text-amber-900 dark:text-amber-100">
                <p className="font-semibold">Does this match your life?</p>
                <p className="text-amber-800 dark:text-amber-200 mt-1 text-xs leading-relaxed">
                  Validate the chart with yes/no questions before treating coaching as calibrated. The score is informational — it never rewrites the chart.
                </p>
                <button
                  onClick={() => router.push("/validate")}
                  className="mt-3 text-xs font-semibold text-amber-900 dark:text-amber-100 underline"
                >
                  Start validation →
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/validate")}
                className="flex-1 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-white dark:bg-gray-900 py-3 rounded-xl text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
              >
                Validate Chart →
              </button>
              <button
                onClick={() => router.push("/coach")}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-black/30 transition-colors"
              >
                Talk to Coach →
              </button>
            </div>

            {/* Data management */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={exportProfile}
                className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-2 border border-gray-100 dark:border-gray-800 rounded-xl transition-colors"
                title="Download your chart data as a JSON backup"
              >
                <Download className="w-3.5 h-3.5" /> Backup data
              </button>
              <button
                onClick={resetChart}
                className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 py-2 border border-gray-100 dark:border-gray-800 rounded-xl transition-colors"
                title="Clear chart and start over"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset chart
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
