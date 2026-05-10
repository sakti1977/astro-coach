"use client";

interface Axis {
  label: string;
  score: number; // 0-100
  prescribed: number; // 0-100 (what astrology prescribes now)
}

interface Props {
  axes: Axis[];
  size?: number;
}

export default function BehaviorRadar({ axes, size = 260 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 30;
  const n = axes.length;

  function getPoint(idx: number, value: number): [number, number] {
    const angle = (Math.PI * 2 * idx) / n - Math.PI / 2;
    const d = (value / 100) * r;
    return [cx + d * Math.cos(angle), cy + d * Math.sin(angle)];
  }

  function getLabel(idx: number): [number, number] {
    const angle = (Math.PI * 2 * idx) / n - Math.PI / 2;
    return [cx + (r + 18) * Math.cos(angle), cy + (r + 18) * Math.sin(angle)];
  }

  const gridLevels = [20, 40, 60, 80, 100];
  const actualPoly = axes.map((a, i) => getPoint(i, a.score)).map(([x, y]) => `${x},${y}`).join(" ");
  const prescribedPoly = axes.map((a, i) => getPoint(i, a.prescribed)).map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* Grid */}
      {gridLevels.map((lvl) => {
        const pts = axes.map((_, i) => getPoint(i, lvl)).map(([x, y]) => `${x},${y}`).join(" ");
        return <polygon key={lvl} points={pts} fill="none" stroke="#E5E7EB" strokeWidth={1} />;
      })}

      {/* Spokes */}
      {axes.map((_, i) => {
        const [x, y] = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E5E7EB" strokeWidth={1} />;
      })}

      {/* Prescribed area */}
      <polygon points={prescribedPoly} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1.5} fillOpacity={0.5} />

      {/* Actual area */}
      <polygon points={actualPoly} fill="#1F2937" stroke="#111827" strokeWidth={2} fillOpacity={0.2} />

      {/* Axis labels */}
      {axes.map((a, i) => {
        const [lx, ly] = getLabel(i);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#6B7280" fontWeight="500">
            {a.label}
          </text>
        );
      })}

      {/* Legend — top-left to avoid overlapping axis labels */}
      <g transform="translate(4, 4)">
        <rect width={10} height={10} fill="#1F2937" fillOpacity={0.3} rx={2} />
        <text x={14} y={8} fontSize={8} fill="#6B7280">Current</text>
        <rect x={60} width={10} height={10} fill="#93C5FD" fillOpacity={0.6} rx={2} />
        <text x={74} y={8} fontSize={8} fill="#6B7280">Prescribed</text>
      </g>
    </svg>
  );
}
