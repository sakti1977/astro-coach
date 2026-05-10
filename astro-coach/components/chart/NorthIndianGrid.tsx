"use client";

import type { ChartDisplay } from "@/lib/profile";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";

interface Props {
  chart: ChartDisplay;
  size?: number;
  highlightHouse?: number;
}

const SIZE = 360;
const S = SIZE / 3; // cell size = 120

// North Indian chart: fixed house positions in a 3x3 grid
// Outer 8 cells = houses 1-8, inner diamond triangles = houses 9-12
// House positions in grid [row, col] for outer cells:
const OUTER_CELLS: Record<number, [number, number]> = {
  1: [0, 1], 2: [0, 2], 3: [1, 2], 4: [2, 2],
  5: [2, 1], 6: [2, 0], 7: [1, 0], 8: [0, 0],
};

// Text center for outer cells
function cellCenter(row: number, col: number): [number, number] {
  return [col * S + S / 2, row * S + S / 2];
}

// Inner diamond triangles for houses 9-12
// Center of 3x3 grid = from (S,S) to (2S,2S)
const cx = SIZE / 2;
const cy = SIZE / 2;
const INNER_TRIANGLES: Record<number, { points: string; textX: number; textY: number }> = {
  9:  { points: `${S},${S} ${2*S},${S} ${cx},${cy}`,   textX: cx,       textY: S + S * 0.3 },
  10: { points: `${2*S},${S} ${2*S},${2*S} ${cx},${cy}`, textX: 2*S - S * 0.3, textY: cy },
  11: { points: `${2*S},${2*S} ${S},${2*S} ${cx},${cy}`, textX: cx,       textY: 2*S - S * 0.3 },
  12: { points: `${S},${2*S} ${S},${S} ${cx},${cy}`,   textX: S + S * 0.3, textY: cy },
};

function getPlanetsInHouse(chart: ChartDisplay, house: number): string[] {
  return Object.entries(chart.planets)
    .filter(([, p]) => p.house === house)
    .map(([key]) => {
      const meta = PLANET_META[key as PlanetKey];
      return meta?.symbol ?? key.slice(0, 2).toUpperCase();
    });
}

function getSignInHouse(chart: ChartDisplay, house: number): string {
  const signNum = (chart.ascendant.sign_num + house - 1) % 12;
  return SIGN_NAMES[signNum].slice(0, 3);
}

export default function NorthIndianGrid({ chart, size = SIZE, highlightHouse }: Props) {
  const scale = size / SIZE;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      className="border border-gray-200 rounded-lg bg-white"
    >
      {/* Outer grid lines */}
      <rect x={0} y={0} width={SIZE} height={SIZE} fill="none" stroke="#D1D5DB" strokeWidth={1} />
      {/* 3x3 grid */}
      <line x1={S} y1={0} x2={S} y2={SIZE} stroke="#D1D5DB" strokeWidth={1} />
      <line x1={2*S} y1={0} x2={2*S} y2={SIZE} stroke="#D1D5DB" strokeWidth={1} />
      <line x1={0} y1={S} x2={SIZE} y2={S} stroke="#D1D5DB" strokeWidth={1} />
      <line x1={0} y1={2*S} x2={SIZE} y2={2*S} stroke="#D1D5DB" strokeWidth={1} />
      {/* Inner diamond diagonals */}
      <line x1={S} y1={S} x2={2*S} y2={2*S} stroke="#D1D5DB" strokeWidth={1} />
      <line x1={2*S} y1={S} x2={S} y2={2*S} stroke="#D1D5DB" strokeWidth={1} />

      {/* Outer houses 1-8 */}
      {Object.entries(OUTER_CELLS).map(([hStr, [row, col]]) => {
        const h = Number(hStr);
        const [tx, ty] = cellCenter(row, col);
        const planets = getPlanetsInHouse(chart, h);
        const sign = getSignInHouse(chart, h);
        const isLagna = h === 1;
        const isHighlighted = h === highlightHouse;

        return (
          <g key={h}>
            {isHighlighted && (
              <rect x={col * S + 1} y={row * S + 1} width={S - 2} height={S - 2}
                fill="#EFF6FF" />
            )}
            {/* House number */}
            <text x={tx} y={ty - 20} textAnchor="middle" fontSize={10}
              fill="#9CA3AF" fontFamily="monospace">
              {h}
            </text>
            {/* Sign abbreviation */}
            <text x={tx} y={ty - 6} textAnchor="middle" fontSize={11}
              fill="#6B7280" fontFamily="monospace">
              {sign}
            </text>
            {/* Ascendant marker */}
            {isLagna && (
              <text x={tx} y={ty + 8} textAnchor="middle" fontSize={9}
                fill="#1D4ED8" fontWeight="bold">
                ASC
              </text>
            )}
            {/* Planets */}
            {planets.map((sym, i) => (
              <text key={i} x={tx + (i - (planets.length - 1) / 2) * 14}
                y={ty + (isLagna ? 22 : 14)}
                textAnchor="middle" fontSize={14} fill="#111827">
                {sym}
              </text>
            ))}
          </g>
        );
      })}

      {/* Inner houses 9-12 */}
      {Object.entries(INNER_TRIANGLES).map(([hStr, tri]) => {
        const h = Number(hStr);
        const planets = getPlanetsInHouse(chart, h);
        const sign = getSignInHouse(chart, h);
        const isHighlighted = h === highlightHouse;

        return (
          <g key={h}>
            {isHighlighted && (
              <polygon points={tri.points} fill="#EFF6FF" />
            )}
            <text x={tri.textX} y={tri.textY - 14} textAnchor="middle" fontSize={9}
              fill="#9CA3AF" fontFamily="monospace">
              {h}
            </text>
            <text x={tri.textX} y={tri.textY} textAnchor="middle" fontSize={10}
              fill="#6B7280">
              {sign}
            </text>
            {planets.map((sym, i) => (
              <text key={i} x={tri.textX + (i - (planets.length - 1) / 2) * 12}
                y={tri.textY + 14}
                textAnchor="middle" fontSize={12} fill="#111827">
                {sym}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
