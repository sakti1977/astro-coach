import { describe, expect, it } from "vitest";
import { parseGeneratedHabits } from "./habit-schema";
import { computeStreak } from "./habit-dates";
import { planToHabits } from "@/app/api/coach/plan-habits/route";

const good = { habit: "Walk 20 minutes before opening email", frequency: "daily", planet: "Saturn", category: "physical", why: "Saturn in H6 wants the body looked after first." };

describe("parseGeneratedHabits", () => {
  it("keeps well-formed habits and normalises the planet", () => {
    expect(parseGeneratedHabits([good])).toEqual([{ ...good, planet: "saturn" }]);
  });

  it("drops ritual items, unknown planets, bad frequencies and duplicates", () => {
    const out = parseGeneratedHabits([
      good,
      { ...good },
      { ...good, habit: "Chant the Shani mantra 108 times" },
      { ...good, habit: "Wear a blue sapphire gemstone" },
      { ...good, habit: "Journal nightly", planet: "pluto" },
      { ...good, habit: "Call a sibling", frequency: "monthly" },
      "not an object",
    ]);
    expect(out.map((h) => h.habit)).toEqual([good.habit]);
  });

  it("returns an empty list for non-array input", () => {
    expect(parseGeneratedHabits({ habits: [good] })).toEqual([]);
  });
});

describe("planToHabits", () => {
  it("only restructures the plan it was given and caps at five", async () => {
    let prompt = "";
    const many = Array.from({ length: 8 }, (_, i) => ({ ...good, habit: `Practice ${i}` }));
    const habits = await planToHabits("**BEHAVIOR**: walk before email", async (p) => {
      prompt = p;
      return JSON.stringify(many);
    });
    expect(prompt).toContain("<plan>\n**BEHAVIOR**: walk before email\n</plan>");
    expect(prompt).toContain("Use ONLY practices that appear in the plan");
    expect(habits).toHaveLength(5);
  });
});

describe("computeStreak", () => {
  const now = new Date(2026, 8, 26, 9, 0); // 26 Sep 2026, local morning

  it("counts back from today", () => {
    expect(computeStreak(["2026-09-24", "2026-09-25", "2026-09-26"], now)).toBe(3);
  });

  it("keeps yesterday's streak alive before today is ticked", () => {
    expect(computeStreak(["2026-09-24", "2026-09-25"], now)).toBe(2);
  });

  it("is zero after a missed day", () => {
    expect(computeStreak(["2026-09-23"], now)).toBe(0);
  });
});
