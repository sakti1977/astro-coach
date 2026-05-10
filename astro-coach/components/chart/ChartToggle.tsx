"use client";

import { useState } from "react";
import NorthIndianGrid from "./NorthIndianGrid";
import SouthIndianGrid from "./SouthIndianGrid";
import type { NatalChart, ChartDisplay } from "@/lib/profile";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";

interface Props {
  chart: NatalChart;
  highlightHouse?: number;
}

type GridView = "north" | "south";
type VargaKey = "d1" | "d9" | "d10" | "d7";

const VARGAS: { key: VargaKey; label: string; short: string; meaning: string; domain: string }[] = [
  { key: "d1", label: "D1 · Rasi",     short: "D1", meaning: "Birth chart",   domain: "The full life — personality, body, all life areas" },
  { key: "d9", label: "D9 · Navamsa",  short: "D9", meaning: "Soul & spouse", domain: "Inner nature, dharma, spouse qualities, spiritual path" },
  { key: "d10", label: "D10 · Dashamsha", short: "D10", meaning: "Career",    domain: "Career, public reputation, professional achievements" },
  { key: "d7", label: "D7 · Saptamsha",  short: "D7", meaning: "Children",   domain: "Children, creativity, legacy, progeny" },
];

function buildVargaChart(chart: NatalChart, varga: VargaKey): ChartDisplay {
  if (varga === "d1") return chart;

  const field = `${varga}_sign_num` as "d9_sign_num" | "d10_sign_num" | "d7_sign_num";
  const ascSignNum = chart.ascendant[field] ?? chart.ascendant.sign_num;

  const planets: ChartDisplay["planets"] = {};
  for (const [key, planet] of Object.entries(chart.planets)) {
    const pSignNum = planet[field] ?? planet.sign_num;
    const house = ((pSignNum - ascSignNum + 12) % 12) + 1;
    planets[key] = {
      sign: SIGN_NAMES[pSignNum],
      sign_num: pSignNum,
      house,
      degree: planet.degree,
      abs_pos: planet.abs_pos,
      retrograde: planet.retrograde,
    };
  }

  return {
    ascendant: {
      sign: SIGN_NAMES[ascSignNum],
      sign_num: ascSignNum,
      degree: 0,
      abs_pos: ascSignNum * 30,
    },
    planets,
  };
}

export default function ChartToggle({ chart, highlightHouse }: Props) {
  const [gridView, setGridView] = useState<GridView>("north");
  const [varga, setVarga] = useState<VargaKey>("d1");

  const display = buildVargaChart(chart, varga);
  const vargaMeta = VARGAS.find(v => v.key === varga)!;

  return (
    <div className="space-y-4">
      {/* Varga selector */}
      <div className="flex flex-wrap gap-1.5">
        {VARGAS.map((v) => (
          <button
            key={v.key}
            onClick={() => setVarga(v.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              varga === v.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Varga meaning strip */}
      {varga !== "d1" && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
          <p className="text-xs font-semibold text-blue-800">{vargaMeta.meaning}</p>
          <p className="text-xs text-blue-600 mt-0.5">{vargaMeta.domain}</p>
          <p className="text-xs text-blue-500 mt-1">
            Ascendant: <span className="font-semibold">{display.ascendant.sign}</span>
          </p>
        </div>
      )}

      {/* North / South toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Style:</span>
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {(["north", "south"] as GridView[]).map((v) => (
            <button
              key={v}
              onClick={() => setGridView(v)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                gridView === v
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {v === "north" ? "North Indian" : "South Indian"}
            </button>
          ))}
        </div>
      </div>

      {/* Chart grid */}
      <div className="flex justify-center">
        {gridView === "north" ? (
          <NorthIndianGrid chart={display} size={340} highlightHouse={varga === "d1" ? highlightHouse : undefined} />
        ) : (
          <SouthIndianGrid chart={display} size={340} />
        )}
      </div>

      {/* Planet legend — show varga sign if not D1 */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {Object.entries(PLANET_META).map(([key, meta]) => {
          const natal = chart.planets[key];
          const disp = display.planets[key];
          if (!natal || !disp) return null;
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <span className="text-base leading-none">{meta.symbol}</span>
              <span className="text-gray-700 font-medium">{meta.label}</span>
              <span className="text-gray-400">
                {disp.sign.slice(0, 3)} H{disp.house}
                {natal.retrograde ? " ®" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
