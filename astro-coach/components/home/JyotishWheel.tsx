import { PLANET_META, SIGN_SYMBOLS, type PlanetKey } from "@/lib/astrology/planets";

/**
 * Hero illustration: the Jyotish sky as three rings — the 27 nakshatras
 * (lunar mansions) outside, the 12 rashis (sidereal signs) in the middle, and
 * the 9 grahas orbiting within. Hand-drawn SVG so it stays crisp at any size,
 * works in both themes (it is its own night sky), and needs no image asset.
 */

const SIZE = 320;
const C = SIZE / 2;
const GRAHAS: PlanetKey[] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];

// Fixed, not random: the server and client must render the same stars.
const STARS: Array<[number, number, number]> = [
  [40, 58, 1.1], [276, 44, 0.9], [300, 120, 1.2], [22, 150, 0.8], [58, 262, 1], [262, 280, 1.1],
  [150, 18, 0.8], [196, 300, 0.9], [110, 296, 0.7], [292, 210, 0.8], [16, 222, 0.9], [88, 30, 0.7],
];

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180; // 0° at the top, clockwise
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

export default function JyotishWheel({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      // jyotish-wheel opts out of the dark-mode chart colour remap in globals.css:
      // this illustration is its own night sky in both themes.
      className={`jyotish-wheel ${className}`.trim()}
      role="img"
      aria-label="The Jyotish sky: 27 nakshatras around 12 rashis, with the 9 grahas orbiting within"
    >
      <defs>
        <radialGradient id="jw-sky" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#312e81" />
          <stop offset="60%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0b0d17" />
        </radialGradient>
        <radialGradient id="jw-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={C} cy={C} r={C - 2} fill="url(#jw-sky)" />
      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#e0e7ff" opacity={0.7} />
      ))}

      {/* 27 nakshatras: 13°20′ each */}
      <circle cx={C} cy={C} r={146} fill="none" stroke="#a5b4fc" strokeOpacity={0.25} />
      {Array.from({ length: 27 }, (_, i) => {
        const deg = (360 / 27) * i;
        const [x1, y1] = polar(140, deg);
        const [x2, y2] = polar(146, deg);
        const [dx, dy] = polar(143, deg + 360 / 54);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a5b4fc" strokeOpacity={0.45} strokeWidth={1} />
            <circle cx={dx} cy={dy} r={1.4} fill="#c7d2fe" opacity={0.85} />
          </g>
        );
      })}

      {/* 12 rashis: 30° each */}
      <circle cx={C} cy={C} r={138} fill="none" stroke="#a5b4fc" strokeOpacity={0.35} />
      <circle cx={C} cy={C} r={104} fill="none" stroke="#a5b4fc" strokeOpacity={0.35} />
      {SIGN_SYMBOLS.map((glyph, i) => {
        const [x1, y1] = polar(104, i * 30);
        const [x2, y2] = polar(138, i * 30);
        const [tx, ty] = polar(121, i * 30 + 15);
        return (
          <g key={glyph}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a5b4fc" strokeOpacity={0.35} />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize={15} fill="#e0e7ff">
              {/* U+FE0E: text presentation, so no platform draws coloured emoji here */}
              {glyph + "\uFE0E"}
            </text>
          </g>
        );
      })}

      {/* 9 grahas */}
      <circle cx={C} cy={C} r={78} fill="none" stroke="#c7d2fe" strokeOpacity={0.2} strokeDasharray="2 4" />
      {GRAHAS.map((key, i) => {
        const [x, y] = polar(78, i * 40 + 10);
        const meta = PLANET_META[key];
        return (
          <g key={key}>
            <circle cx={x} cy={y} r={12} fill={meta.bg} stroke={meta.color} strokeWidth={1.5} />
            <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={12} fill={meta.color}>
              {meta.symbol + "\uFE0E"}
            </text>
          </g>
        );
      })}

      {/* Jyoti — the light at the centre */}
      <circle cx={C} cy={C} r={48} fill="url(#jw-glow)" />
      <text x={C} y={C - 4} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={600} fill="#fff7ed">
        ज्योतिष
      </text>
      <text x={C} y={C + 15} textAnchor="middle" dominantBaseline="central" fontSize={7.5} letterSpacing={1.5} fill="#fde68a">
        SCIENCE OF LIGHT
      </text>
    </svg>
  );
}
