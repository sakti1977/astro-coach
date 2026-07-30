import { describe, it, expect, vi, afterEach } from "vitest";
import { buildValidatorUserPrompt } from "./validator";
import type { NatalChart } from "@/lib/profile";

// HARNESS-01 regression guard: age used to be computed via `new Date(birthDate)`,
// which parses a date-only "YYYY-MM-DD" string as UTC midnight — reading it back
// with local getters (getMonth/getDate) then silently shifts the effective birth
// date by a day in timezones behind UTC, producing an intermittent off-by-one
// age. The fix parses the string manually instead. These tests fix "today" via
// fake timers and check exact age-boundary arithmetic, which is what actually
// matters — the old bug was timezone-dependent, so pinning a specific timezone
// here would just make the test flaky rather than meaningful.

const CHART: NatalChart = {
  ascendant: { sign: "Leo", sign_num: 4, degree: 12.5, abs_pos: 132.5 },
  planets: {},
  moon_nakshatra: { num: 7, name: "Pushya", pada: 1, lord: "Saturn" },
};

function ageLine(birthDate: string): string {
  const prompt = buildValidatorUserPrompt(CHART, birthDate);
  const match = prompt.match(/Person's current age: (\d+) years old/);
  if (!match) throw new Error(`No age line found in prompt: ${prompt}`);
  return match[1];
}

describe("buildValidatorUserPrompt age calculation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes age correctly once the birthday has already passed this year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 30)); // 30 Jul 2026, local time
    expect(ageLine("1990-06-15")).toBe("36"); // birthday (Jun 15) already passed
  });

  it("computes age correctly when the birthday has not yet happened this year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 30)); // 30 Jul 2026
    expect(ageLine("1990-08-15")).toBe("35"); // birthday (Aug 15) still ahead
  });

  it("turns the new age exactly on the birthday itself", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 30, 0, 0, 0)); // 30 Jul 2026, local midnight
    expect(ageLine("1990-07-30")).toBe("36"); // today IS the birthday
  });

  it("is still one year younger the day before the birthday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29)); // 29 Jul 2026 — day before birthday
    expect(ageLine("1990-07-30")).toBe("35");
  });

  it("handles a Dec 31 birth date correctly right after New Year", () => {
    // The exact edge this bug historically clustered around (see the matching
    // DashaTimeline.tsx fix) — a UTC-midnight misparse here would have shown
    // up as the wrong age depending on the runtime's timezone.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1)); // 1 Jan 2026
    expect(ageLine("1990-12-31")).toBe("35"); // birthday is tomorrow, not yet had it
  });

  it("handles a Jan 1 birth date correctly on Jan 1 itself", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1)); // 1 Jan 2026
    expect(ageLine("1990-01-01")).toBe("36"); // today is the birthday
  });
});
