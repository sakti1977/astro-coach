import { describe, it, expect } from "vitest";
import { buildDailyTransitNote } from "./transitNote";

describe("buildDailyTransitNote", () => {
  it("returns null without planets", () => {
    expect(buildDailyTransitNote(undefined)).toBeNull();
  });

  it("names the user's actual transit house, not a sun-sign horoscope", () => {
    const note = buildDailyTransitNote({
      planets: {
        saturn: {
          sign: "Pisces",
          sign_num: 11,
          degree: 1,
          abs_pos: 331,
          house: 8,
          retrograde: false,
          house_from_natal_lagna: 8,
        },
      },
      calculated_at: "2026-09-20T00:00:00.000Z",
      sade_sati: null,
    });
    expect(note).toContain("Pisces");
    expect(note).toContain("house 8");
    expect(note?.toLowerCase()).not.toContain("all pisces");
  });
});
