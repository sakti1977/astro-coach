import { ImageResponse } from "next/og";

export const alt = "Jyotish Coach: your Vedic birth chart and a personal AI coach";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Nine grahas as dots on a ring. Plain shapes: the built-in font has no planet glyphs.
const RING = 150;
const GRAHAS = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
  return { x: 180 + RING * Math.cos(a) - 14, y: 180 + RING * Math.sin(a) - 14, big: i % 3 === 0 };
});

// Link preview for WhatsApp, LinkedIn, X and Facebook. Built at compile time.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
          background: "linear-gradient(135deg, #0b0d17 0%, #1e1b4b 60%, #312e81 100%)",
          color: "#f5f3ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 24, letterSpacing: 4, color: "#a5b4fc", textTransform: "uppercase" }}>
            Vedic astrology · personal coaching
          </div>
          <div style={{ fontSize: 92, fontWeight: 700, marginTop: 20 }}>Jyotish Coach</div>
          <div style={{ fontSize: 36, marginTop: 24, color: "#c7d2fe", lineHeight: 1.35, maxWidth: 640 }}>
            Your birth chart, calculated precisely. Turned into habits, not fear.
          </div>
          <div style={{ fontSize: 26, marginTop: 40, color: "#818cf8" }}>jyotishcoach.com</div>
        </div>
        <div style={{ width: 360, height: 360, position: "relative", display: "flex" }}>
          <div style={{ position: "absolute", left: 30, top: 30, width: 300, height: 300, borderRadius: 150, border: "2px solid #6366f1" }} />
          <div style={{ position: "absolute", left: 120, top: 120, width: 120, height: 120, borderRadius: 60, background: "#fbbf24", boxShadow: "0 0 80px #f59e0b" }} />
          {GRAHAS.map((g, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: g.x,
                top: g.y,
                width: 28,
                height: 28,
                borderRadius: 14,
                background: g.big ? "#e0e7ff" : "#818cf8",
              }}
            />
          ))}
        </div>
      </div>
    ),
    size
  );
}
