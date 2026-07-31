"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { DashaData } from "@/lib/profile";
import { PLANET_META, type PlanetKey } from "@/lib/astrology/planets";
import { dignityPhrase } from "@/lib/astrology/dignityFraming";
import SignInRequired from "@/components/SignInRequired";

interface Props {
  dashas: DashaData;
  birthDate: string;
}

interface DashaPrediction {
  themes: string[];
  cultivate: string[];
  challenges: string[];
  actions: string[];
  summary: string;
}

export default function DashaTimeline({ dashas, birthDate }: Props) {
  const { data: session } = useSession();
  const [selectedMaha, setSelectedMaha] = useState<number | null>(null);
  const [selectedAntar, setSelectedAntar] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<DashaPrediction | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  // Parsed manually (not `new Date(birthDate).getFullYear()`) to avoid the
  // UTC-midnight-vs-local-getter shift that can misread a Jan 1/Dec 31 birth
  // date as the wrong year in some timezones. Note: the `pct()` calculation
  // below is safe as-is even with `new Date(dateStr)` — every date string it
  // touches (including birthDate) gets the same UTC-parse shift, which
  // cancels out in the subtraction.
  const birthYear = Number(birthDate.split("-")[0]);
  const totalSpan = new Date(dashas.mahadashas[dashas.mahadashas.length - 1].end).getTime()
    - new Date(birthDate).getTime();

  function pct(dateStr: string): number {
    const t = new Date(dateStr).getTime() - new Date(birthDate).getTime();
    return Math.max(0, Math.min(100, (t / totalSpan) * 100));
  }

  function getColor(lord: string): string {
    const meta = PLANET_META[lord.toLowerCase() as PlanetKey];
    return meta?.color ?? "#6B7280";
  }

  function dignityCaption(lord: string): string | null {
    return dignityPhrase(dashas.lord_dignity?.[lord.toLowerCase()]);
  }

  async function loadPrediction(idx: number) {
    const maha = dashas.mahadashas[idx];
    if (selectedMaha === idx) {
      setSelectedMaha(null);
      setPrediction(null);
      setPredictionError("");
      return;
    }
    setSelectedMaha(idx);
    setPrediction(null);
    setPredictionError("");

    // Auto-expand the current Antardasha so the current Pratyantardasha is
    // visible without a manual second click, when opening the current Maha.
    const isCurrentMaha = maha.lord === dashas.current_maha;
    if (isCurrentMaha) {
      const antarIdx = maha.antardashas.findIndex((a) => a.lord === dashas.current_antar);
      if (antarIdx !== -1) setSelectedAntar(`${idx}-${antarIdx}`);
    }

    if (!session) {
      // Guest: the timeline itself (including pratyantardasha/dignity, both
      // already free) stays visible, but AI predictions require an account —
      // rendered via the <SignInRequired> branch below instead of fetching.
      return;
    }

    setLoadingPrediction(true);
    try {
      const profile = JSON.parse(localStorage.getItem("astro_coach_profile") ?? "{}");
      const res = await fetch("/api/dasha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart: profile.chart,
          dashaLord: maha.lord,
          years: maha.balance_years,
          ...(isCurrentMaha
            ? { currentAntarLord: dashas.current_antar, currentPratyantarLord: dashas.current_pratyantar }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Prediction failed");
      if (!data.prediction) throw new Error("No prediction returned — try again");
      setPrediction(data.prediction);
    } catch (e: unknown) {
      setPredictionError(e instanceof Error ? e.message : "Failed to load prediction");
    } finally {
      setLoadingPrediction(false);
    }
  }

  const todayPct = pct(today);

  return (
    <div className="space-y-6">
      {/* Current period banner */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Period</p>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{PLANET_META[dashas.current_maha.toLowerCase() as PlanetKey]?.symbol ?? "●"}</span>
          <div>
            <p className="font-semibold text-gray-900">
              {dashas.current_maha} Maha Dasha / {dashas.current_antar} Antardasha
              {dashas.current_pratyantar && ` / ${dashas.current_pratyantar} Pratyantardasha`}
            </p>
            <p className="text-sm text-gray-500">
              Maha ends: {new Date(dashas.current_maha_end).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
            </p>
            {dignityCaption(dashas.current_maha) && (
              <p className="text-xs text-gray-500 mt-0.5">{dashas.current_maha} is {dignityCaption(dashas.current_maha)}.</p>
            )}
          </div>
        </div>
      </div>

      {/* Timeline bar */}
      <div className="relative">
        <div className="relative h-10 rounded-full overflow-hidden border border-gray-200 bg-gray-50">
          {dashas.mahadashas.map((maha, i) => {
            const left = pct(maha.start);
            const right = 100 - pct(maha.end);
            const isCurrent = maha.lord === dashas.current_maha;
            return (
              <button
                key={i}
                onClick={() => loadPrediction(i)}
                className="absolute top-0 h-full flex items-center justify-center text-white text-xs font-medium transition-opacity hover:opacity-90 cursor-pointer"
                style={{
                  left: `${left}%`,
                  right: `${right}%`,
                  backgroundColor: getColor(maha.lord),
                  opacity: selectedMaha === i ? 1 : isCurrent ? 0.9 : 0.65,
                  borderRight: "1px solid rgba(255,255,255,0.3)",
                }}
                title={`${maha.lord}: ${maha.start} → ${maha.end}`}
              >
                {pct(maha.end) - pct(maha.start) > 8 ? maha.lord.slice(0, 3) : ""}
              </button>
            );
          })}
          {/* Today marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-900 z-10"
            style={{ left: `${todayPct}%` }}
          >
            <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-gray-900" />
          </div>
        </div>
        {/* Year labels */}
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{birthYear}</span>
          <span className="text-gray-900 font-medium">Today</span>
          <span>{birthYear + 120}</span>
        </div>
      </div>

      {/* Maha Dasha list */}
      <div className="space-y-2">
        {dashas.mahadashas.map((maha, i) => {
          const isCurrent = maha.lord === dashas.current_maha;
          const isPast = maha.end < today;
          const isSelected = selectedMaha === i;

          return (
            <div key={i} className={`rounded-lg border transition-all ${
              isSelected ? "border-gray-400 shadow-sm" : "border-gray-100"
            } ${isPast ? "opacity-50" : ""}`}>
              <button
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg"
                onClick={() => loadPrediction(i)}
              >
                <span className="text-xl">{PLANET_META[maha.lord.toLowerCase() as PlanetKey]?.symbol ?? "●"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{maha.lord} Maha Dasha</span>
                    {isCurrent && (
                      <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Now</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(maha.start).getFullYear()} – {new Date(maha.end).getFullYear()}
                    {" · "}{Math.round((new Date(maha.end).getTime() - new Date(maha.start).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years
                    {dignityCaption(maha.lord) && ` · ${dignityCaption(maha.lord)}`}
                  </p>
                </div>
                <span className="text-gray-300">{isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
              </button>

              {/* Prediction panel */}
              {isSelected && (
                <div className="px-3 pb-3 border-t border-gray-100 mt-0">
                  {!session ? (
                    <SignInRequired feature="AI dasha predictions" />
                  ) : loadingPrediction ? (
                    <p className="text-sm text-gray-500 py-4 text-center">Reading the planetary currents...</p>
                  ) : predictionError ? (
                    <p className="text-sm text-red-500 py-3">{predictionError}</p>
                  ) : prediction ? (
                    <div className="pt-3 space-y-3">
                      <p className="text-sm text-gray-700 italic">{prediction.summary}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Core Themes</p>
                          <ul className="text-sm text-gray-700 space-y-0.5">
                            {prediction.themes?.map((t, j) => <li key={j} className="flex gap-1"><span>·</span>{t}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Cultivate</p>
                          <ul className="text-sm text-gray-700 space-y-0.5">
                            {prediction.cultivate?.map((t, j) => <li key={j} className="flex gap-1"><span>·</span>{t}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Watch Out For</p>
                          <ul className="text-sm text-gray-700 space-y-0.5">
                            {prediction.challenges?.map((t, j) => <li key={j} className="flex gap-1"><span>·</span>{t}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Action Areas</p>
                          <ul className="text-sm text-gray-700 space-y-0.5">
                            {prediction.actions?.map((t, j) => <li key={j} className="flex gap-1"><span>·</span>{t}</li>)}
                          </ul>
                        </div>
                      </div>

                      {/* Antardasha list */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Sub-Periods (Antardasha)</p>
                        <div className="space-y-1.5">
                          {maha.antardashas.map((a, j) => {
                            const isCurrentAntar = a.lord === dashas.current_antar && isCurrent;
                            const antarKey = `${i}-${j}`;
                            const isAntarExpanded = selectedAntar === antarKey;
                            const hasPratyantars = a.pratyantardashas && a.pratyantardashas.length > 0;

                            return (
                              <div key={j} className="border border-gray-100 rounded">
                                <button
                                  onClick={() => hasPratyantars && setSelectedAntar(isAntarExpanded ? null : antarKey)}
                                  className={`w-full text-left text-xs px-2 py-1.5 rounded flex items-center justify-between ${
                                    isCurrentAntar ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                  } ${!hasPratyantars ? "cursor-default" : "cursor-pointer"}`}
                                  title={`${a.start} → ${a.end}`}
                                  disabled={!hasPratyantars}
                                >
                                  <span>
                                    {PLANET_META[a.lord.toLowerCase() as PlanetKey]?.symbol ?? ""} {a.lord}
                                    {isCurrentAntar && <span className="ml-1 text-[10px]">● Now</span>}
                                  </span>
                                  {hasPratyantars && (
                                    <span className={isCurrentAntar ? "text-white" : "text-gray-500"}>
                                      {isAntarExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </span>
                                  )}
                                </button>

                                {/* Pratyantardasha (third level) */}
                                {isAntarExpanded && hasPratyantars && (
                                  <div className="px-2 pb-2 pt-1 bg-gray-50">
                                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Pratyantar Dasha</p>
                                    <div className="flex flex-wrap gap-1">
                                      {a.pratyantardashas!.map((p, k) => {
                                        const isCurrentPratyantar = p.lord === dashas.current_pratyantar && isCurrentAntar;
                                        return (
                                          <span
                                            key={k}
                                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                              isCurrentPratyantar
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "border-gray-200 bg-white text-gray-600"
                                            }`}
                                            title={`${p.lord}: ${p.start} → ${p.end}`}
                                          >
                                            {PLANET_META[p.lord.toLowerCase() as PlanetKey]?.symbol ?? ""} {p.lord}
                                            {isCurrentPratyantar && <span className="ml-1">● Now</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-2">Click to generate prediction</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
