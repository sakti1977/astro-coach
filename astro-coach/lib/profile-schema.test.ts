import { describe, it, expect } from "vitest";
import { parseBackupPayload, parseNatalChart, parseSyncPushBody } from "./profile-schema";

const moon = {
  sign: "Cancer",
  sign_num: 3,
  degree: 5,
  abs_pos: 95,
  house: 12,
  retrograde: false,
  nakshatra: { num: 7, name: "Pushya", pada: 1, lord: "Saturn" },
};

const chart = {
  ascendant: { sign: "Leo", sign_num: 4, degree: 12.5, abs_pos: 132.5 },
  planets: { moon },
  moon_nakshatra: moon.nakshatra,
};

const dashas = {
  mahadashas: [{ lord: "Saturn", years: 19, start: "2020-01-01", end: "2039-01-01", antardashas: [] }],
  current_maha: "Saturn",
  current_antar: "Saturn",
  current_pratyantar: "Saturn",
  current_maha_end: "2039-01-01",
  current_antar_end: "2027-01-01",
  current_pratyantar_end: "2026-06-01",
};

const profile = {
  birthData: {
    name: "Ada",
    date: "1990-07-15",
    time: "06:30",
    lat: 22.5,
    lng: 88.3,
    timezone: "Asia/Kolkata",
    city: "Kolkata",
  },
  chart,
  dashas,
  validation: { questions: [], accuracyScore: 0, confirmedThemes: [], isValidated: false },
  goals: [],
  habits: [],
  chatHistory: [],
  coaching: { lastUpdated: "2026-09-20T00:00:00.000Z" },
};

describe("parseBackupPayload", () => {
  it("accepts a raw profile", () => {
    const result = parseBackupPayload(profile);
    expect(result.ok).toBe(true);
  });

  it("accepts the Profile-page export wrapper", () => {
    const result = parseBackupPayload({ profile, observations: [], exportedAt: "2026-09-20T00:00:00.000Z" });
    expect(result.ok).toBe(true);
  });

  it("rejects a file that only has truthy chart/dashas keys", () => {
    const result = parseBackupPayload({ chart: { foo: 1 }, dashas: { bar: 1 } });
    expect(result.ok).toBe(false);
  });
});

describe("parseNatalChart", () => {
  it("requires a natal Moon", () => {
    const result = parseNatalChart({
      ...chart,
      planets: { sun: moon },
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseSyncPushBody", () => {
  it("allows a blank chart on a new account", () => {
    const result = parseSyncPushBody({
      profile: { ...profile, chart: null, dashas: null },
      observations: [],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects malformed observations instead of persisting them", () => {
    const result = parseSyncPushBody({
      profile,
      observations: [{ id: "x" }],
    });
    expect(result.ok).toBe(false);
  });
});
