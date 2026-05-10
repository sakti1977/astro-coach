"use client";

import type { ChartDisplay } from "@/lib/profile";
import { PLANET_META, SIGN_NAMES, SIGN_SYMBOLS, type PlanetKey } from "@/lib/astrology/planets";

interface Props {
  chart: ChartDisplay;
  size?: number;
}

const SIZE = 400;
const CELL = SIZE / 4;

// South Indian chart: signs are FIXED in a 4x4 grid (12 outer cells, 4 center empty)
// Sign numbers mapped to grid positions [row, col]
// Pisces(11) top-left, going clockwise: Aries(0), Taurus(1), Gemini(2),
// Cancer(3), Leo(4), Virgo(5) bottom-right going left, Libra(6), Scorpio(7),
// Sagittarius(8), Capricorn(9), Aquarius(10) up left side
const SIGN_CELLS: Record<number, [number, number]> = {
  11: [0, 0], 0: [0, 1], 1: [0, 2], 2: [0, 3],
  3:  [1, 3], 4: [2, 3],
  5:  [3, 3], 6: [3, 2], 7: [3, 1], 8: [3, 0],
  9:  [2, 0], 10: [1, 0],
};

// Center cells (empty / decorative)
const CENTER_CELLS = [[1,1],[1,2],[2,1],[2,2]];

function getPlanetsInSign(chart: ChartDisplay, signNum: number): Array<{ key: string; symbol: string; retrograde: boolean }> {
  return Object.entries(chart.planets)
    .filter(([, p]) => p.sign_num === signNum)
    .map(([key, p]) => ({
      key,
      symbol: PLANET_META[key as PlanetKey]?.symbol ?? key.slice(0, 2),
      retrograde: p.retrograde,
    }));
}

export default function SouthIndianGrid({ chart, size = SIZE }: Props) {
  const cell = size / 4;
  const ascSignNum = chart.ascendant.sign_num;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
      className="border border-gray-200 rounded-lg bg-white">

      {/* Grid lines */}
      {[0, 1, 2, 3, 4].map(i => (
        <g key={i}>
          <line x1={i * cell} y1={0} x2={i * cell} y2={size} stroke="#D1D5DB" strokeWidth={1} />
          <line x1={0} y1={i * cell} x2={size} y2={i * cell} stroke="#D1D5DB" strokeWidth={1} />
        </g>
      ))}

      {/* Center decorative area */}
      {CENTER_CELLS.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell}
          fill="#F9FAFB" />
      ))}
      {/* Center label */}
      <text x={size / 2} y={size / 2 - 8} textAnchor="middle" fontSize={12}
        fill="#9CA3AF" fontWeight="bold">ASTRO</text>
      <text x={size / 2} y={size / 2 + 8} textAnchor="middle" fontSize={12}
        fill="#9CA3AF" fontWeight="bold">COACH</text>

      {/* Sign cells */}
      {Object.entries(SIGN_CELLS).map(([signStr, [row, col]]) => {
        const signNum = Number(signStr);
        const x = col * cell;
        const y = row * cell;
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const isAsc = signNum === ascSignNum;
        const planets = getPlanetsInSign(chart, signNum);

        // House number from lagna
        const houseNum = ((signNum - ascSignNum + 12) % 12) + 1;

        return (
          <g key={signNum}>
            {isAsc && (
              <>
                <rect x={x + 1} y={y + 1} width={cell - 2} height={cell - 2}
                  fill="#EFF6FF" />
                {/* Ascendant diagonal marker */}
                <line x1={x} y1={y} x2={x + 22} y2={y} stroke="#1D4ED8" strokeWidth={2} />
                <line x1={x} y1={y} x2={x} y2={y + 22} stroke="#1D4ED8" strokeWidth={2} />
              </>
            )}

            {/* Sign symbol + name */}
            <text x={cx} y={y + 14} textAnchor="middle" fontSize={12}
              fill={isAsc ? "#1D4ED8" : "#374151"}>
              {SIGN_SYMBOLS[signNum]}
            </text>
            <text x={cx} y={y + 26} textAnchor="middle" fontSize={9}
              fill="#9CA3AF">
              {SIGN_NAMES[signNum].slice(0, 3)} ({houseNum})
            </text>

            {/* Planets */}
            <g>
              {planets.map((p, i) => {
                const row2 = Math.floor(i / 2);
                const col2 = i % 2;
                const px = x + 8 + col2 * (cell / 2 - 8);
                const py = y + 36 + row2 * 16;
                return (
                  <text key={p.key} x={px} y={py} fontSize={13}
                    fill="#111827" fontWeight={p.retrograde ? "normal" : "bold"}>
                    {p.symbol}{p.retrograde ? "ᴿ" : ""}
                  </text>
                );
              })}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
