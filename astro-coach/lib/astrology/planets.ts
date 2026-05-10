export type PlanetKey = "sun" | "moon" | "mars" | "mercury" | "jupiter" | "venus" | "saturn" | "rahu" | "ketu";

export const PLANET_META: Record<PlanetKey, {
  label: string; symbol: string; color: string; bg: string;
  element: string; qualities: string[]; behaviorMode: string;
}> = {
  sun: {
    label: "Sun", symbol: "☉", color: "#D97706", bg: "#FEF3C7",
    element: "Fire",
    qualities: ["leadership", "confidence", "authority", "vitality", "discipline"],
    behaviorMode: "Sovereign",
  },
  moon: {
    label: "Moon", symbol: "☽", color: "#6B7280", bg: "#F3F4F6",
    element: "Water",
    qualities: ["intuition", "nurturing", "adaptability", "emotion", "memory"],
    behaviorMode: "Nurturer",
  },
  mars: {
    label: "Mars", symbol: "♂", color: "#DC2626", bg: "#FEE2E2",
    element: "Fire",
    qualities: ["courage", "action", "drive", "competition", "physical energy"],
    behaviorMode: "Warrior",
  },
  mercury: {
    label: "Mercury", symbol: "☿", color: "#059669", bg: "#D1FAE5",
    element: "Earth",
    qualities: ["communication", "analysis", "learning", "networking", "logic"],
    behaviorMode: "Analyst",
  },
  jupiter: {
    label: "Jupiter", symbol: "♃", color: "#7C3AED", bg: "#EDE9FE",
    element: "Ether",
    qualities: ["wisdom", "expansion", "teaching", "ethics", "generosity"],
    behaviorMode: "Sage",
  },
  venus: {
    label: "Venus", symbol: "♀", color: "#DB2777", bg: "#FCE7F3",
    element: "Water",
    qualities: ["creativity", "beauty", "harmony", "relationships", "luxury"],
    behaviorMode: "Diplomat",
  },
  saturn: {
    label: "Saturn", symbol: "♄", color: "#1E3A5F", bg: "#DBEAFE",
    element: "Air",
    qualities: ["discipline", "perseverance", "structure", "patience", "service"],
    behaviorMode: "Architect",
  },
  rahu: {
    label: "Rahu", symbol: "☊", color: "#374151", bg: "#F9FAFB",
    element: "Air",
    qualities: ["ambition", "innovation", "obsession", "worldly desire", "risk-taking"],
    behaviorMode: "Seeker",
  },
  ketu: {
    label: "Ketu", symbol: "☋", color: "#78350F", bg: "#FEF3C7",
    element: "Fire",
    qualities: ["detachment", "spirituality", "past mastery", "release", "insight"],
    behaviorMode: "Mystic",
  },
};

export const SIGN_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export const SIGN_SYMBOLS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

export const NAKSHATRA_NAMES = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
  "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

export const DASHA_SEQUENCE: PlanetKey[] = [
  "ketu", "venus", "sun", "moon", "mars", "rahu", "jupiter", "saturn", "mercury",
];

export const DASHA_YEARS: Record<PlanetKey, number> = {
  ketu: 7, venus: 20, sun: 6, moon: 10, mars: 7,
  rahu: 18, jupiter: 16, saturn: 19, mercury: 17,
};
