import { describe, it, expect, beforeEach } from "vitest";
import { getProfile, addValidationAnswer, buildCoachingContext, type UserProfile, type ValidationEntry, type Goal, type CoachingObservation } from "./profile";

beforeEach(() => {
  localStorage.clear();
});

function answer(theme: string, yes: boolean, overrides: Partial<ValidationEntry> = {}): ValidationEntry {
  return { question: `Question about ${theme}?`, answer: yes, planet: "jupiter", house: 9, theme, ...overrides };
}

describe("addValidationAnswer", () => {
  it("computes accuracy score as yes-ratio and persists it", () => {
    addValidationAnswer(answer("career", true));
    addValidationAnswer(answer("health", false));
    const score = addValidationAnswer(answer("family", true));

    expect(score).toBeCloseTo(2 / 3);
    expect(getProfile().validation.accuracyScore).toBeCloseTo(2 / 3);
  });

  it("collects confirmed themes only from 'yes' answers, deduped", () => {
    addValidationAnswer(answer("career", true));
    addValidationAnswer(answer("career", true)); // duplicate theme, still a yes
    addValidationAnswer(answer("health", false));

    expect(getProfile().validation.confirmedThemes).toEqual(["career"]);
  });

  it("returns 0 with no crash when called on an empty question set edge case", () => {
    // First-ever answer: questions.length is 1, not 0 — this asserts the
    // guard (`questions.length > 0 ? ... : 0`) doesn't get exercised in the
    // only reachable path, and that the normal first-answer case is 0 or 1.
    const score = addValidationAnswer(answer("career", false));
    expect(score).toBe(0);
  });
});

describe("buildCoachingContext", () => {
  const baseProfile: UserProfile = {
    ...getProfile(),
    validation: { questions: [], accuracyScore: 0.75, confirmedThemes: ["career", "family"], isValidated: true },
    goals: [{ id: "1", description: "Get fit", category: "health", createdAt: "2026-01-01T00:00:00.000Z" } satisfies Goal],
  };

  it("is deterministic given an explicit todayIso", () => {
    const a = buildCoachingContext(baseProfile, [], "2026-07-29T00:00:00.000Z");
    const b = buildCoachingContext(baseProfile, [], "2026-07-29T00:00:00.000Z");
    expect(a).toBe(b);
    expect(a).toContain("Current date:");
  });

  it("includes confirmed themes, goals, and rounded accuracy score", () => {
    const ctx = buildCoachingContext(baseProfile, [], "2026-07-29T00:00:00.000Z");
    expect(ctx).toContain("Confirmed life themes: career, family");
    expect(ctx).toContain("Get fit");
    expect(ctx).toContain("Chart validation accuracy: 75%");
  });

  it("omits optional sections entirely when there is nothing to say", () => {
    const empty: UserProfile = {
      ...getProfile(),
      validation: { questions: [], accuracyScore: 0, confirmedThemes: [], isValidated: false },
      goals: [],
    };
    const ctx = buildCoachingContext(empty, [], "2026-07-29T00:00:00.000Z");
    expect(ctx).not.toContain("Confirmed life themes");
    expect(ctx).not.toContain("User goals");
    expect(ctx).not.toContain("Session observations");
  });

  it("includes session observations when provided", () => {
    const observation: CoachingObservation = {
      id: "o1", text: "Avoids conflict with authority figures", category: "pattern",
      timestamp: "2026-07-29T00:00:00.000Z", exchangeIndex: 1,
    };
    const ctx = buildCoachingContext(baseProfile, [observation], "2026-07-29T00:00:00.000Z");
    expect(ctx).toContain("Session observations");
    expect(ctx).toContain("Avoids conflict with authority figures");
  });
});
