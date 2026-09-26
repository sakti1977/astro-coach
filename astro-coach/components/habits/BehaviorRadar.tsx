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
    <div className="flex flex-col items-center gap-2">
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

    </svg>
      {/* Legend as HTML under the chart: inside the SVG it collided with axis labels. */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-800/30 dark:bg-gray-200/30" /> Current
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-300/60" /> Prescribed
        </span>
      </div>
    </div>
  );
}
