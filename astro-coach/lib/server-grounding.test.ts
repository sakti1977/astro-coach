import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchChart, fetchDashas } = vi.hoisted(() => ({
  fetchChart: vi.fn(),
  fetchDashas: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: null }));
vi.mock("@/lib/ephemeris", () => ({
  fetchChart,
  fetchDashas,
  ephemerisClientErrorMessage: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { resolveNatalGrounding } from "./server-grounding";

const birth = {
  name: "Ada",
  date: "1990-07-15",
  time: "06:30",
  lat: 22.5,
  lng: 88.3,
  timezone: "Asia/Kolkata",
  city: "Kolkata",
};

const moon = {
  sign: "Cancer",
  sign_num: 3,
  degree: 5,
  abs_pos: 95,
  house: 12,
  retrograde: false,
  nakshatra: { num: 7, name: "Pushya", pada: 1, lord: "Saturn" },
};

const computedChart = {
  ascendant: { sign: "Leo", sign_num: 4, degree: 12.5, abs_pos: 132.5 },
  planets: { moon },
  moon_nakshatra: moon.nakshatra,
};

const computedDashas = {
  mahadashas: [{ lord: "Saturn", years: 19, start: "2020-01-01", end: "2039-01-01" }],
  current_maha: "Saturn",
  current_antar: "Saturn",
  current_maha_end: "2039-01-01",
  current_antar_end: "2027-01-01",
};

describe("resolveNatalGrounding", () => {
  beforeEach(() => {
    fetchChart.mockReset();
    fetchDashas.mockReset();
    fetchChart.mockResolvedValue(computedChart);
    fetchDashas.mockResolvedValue(computedDashas);
  });

  it("rejects a request that does not include birth data", async () => {
    const result = await resolveNatalGrounding("user-1", { chart: computedChart });
    expect(result).toMatchObject({ status: 400 });
    expect(fetchChart).not.toHaveBeenCalled();
  });

  it("uses the chart the ephemeris service returns, not positions from the browser", async () => {
    const result = await resolveNatalGrounding("user-1", birth);
    expect(result).toMatchObject({ source: "computed", chart: computedChart });
    expect(fetchChart).toHaveBeenCalledWith({
      name: "Ada",
      year: 1990,
      month: 7,
      day: 15,
      hour: 6,
      minute: 30,
      lat: 22.5,
      lng: 88.3,
      tz_str: "Asia/Kolkata",
    });
  });

  it("returns 503 when the ephemeris service cannot be reached", async () => {
    fetchChart.mockRejectedValue(new Error("Cannot reach ephemeris service at http://127.0.0.1:8000"));
    const result = await resolveNatalGrounding(undefined, birth);
    expect(result).toMatchObject({ status: 503 });
  });
});
