import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchChart, fetchDashas, admin } = vi.hoisted(() => ({
  fetchChart: vi.fn(),
  fetchDashas: vi.fn(),
  admin: { current: null as unknown },
}));

vi.mock("@/lib/supabase-admin", () => ({
  get supabaseAdmin() {
    return admin.current;
  },
}));
vi.mock("@/lib/ephemeris", () => ({
  fetchChart,
  fetchDashas,
  ephemerisClientErrorMessage: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { chartSourceMode, resolveNatalGrounding } from "./server-grounding";

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

function storedRow(overrides: { ascSignNum?: number; lat?: number } = {}) {
  return {
    chart: { ...computedChart, ascendant: { ...computedChart.ascendant, sign_num: overrides.ascSignNum ?? 4 } },
    dashas: computedDashas,
    goals: [],
    habits: [],
    birth_data: { ...birth, lat: overrides.lat ?? birth.lat },
    updated_at: "2026-10-01T00:00:00Z",
  };
}

function useStoredRow(row: unknown) {
  admin.current = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
  };
}

describe("chart source for signed-in users", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const info = vi.spyOn(console, "info").mockImplementation(() => {});

  beforeEach(() => {
    fetchChart.mockReset();
    fetchDashas.mockReset();
    fetchChart.mockResolvedValue(computedChart);
    fetchDashas.mockResolvedValue(computedDashas);
    warn.mockClear();
    info.mockClear();
  });

  afterEach(() => {
    admin.current = null;
    delete process.env.CHART_SOURCE_MODE;
  });

  it("defaults to shadow mode", () => {
    expect(chartSourceMode()).toBe("shadow");
    process.env.CHART_SOURCE_MODE = "bogus";
    expect(chartSourceMode()).toBe("shadow");
  });

  it("stored mode serves the saved chart without calling the ephemeris", async () => {
    process.env.CHART_SOURCE_MODE = "stored";
    useStoredRow(storedRow({ ascSignNum: 9 }));
    const result = await resolveNatalGrounding("stored-user-1", undefined);
    expect(result).toMatchObject({ source: "server" });
    expect(fetchChart).not.toHaveBeenCalled();
  });

  it("shadow mode serves the saved chart, then logs a tampered one once", async () => {
    useStoredRow(storedRow({ ascSignNum: 9, lat: 11.1 }));
    const result = await resolveNatalGrounding("shadow-user-1", undefined);
    expect(result).toMatchObject({ source: "server" });
    expect((result as unknown as { chart: typeof computedChart }).chart.ascendant.sign_num).toBe(9);

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(warn.mock.calls[0][0]).toMatch(/MISMATCH user=shadow-u fields=ascendant\.sign_num/);
    expect(warn.mock.calls[0][0]).not.toMatch(/Kolkata|1990/);

    await resolveNatalGrounding("shadow-user-1", undefined);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchChart).toHaveBeenCalledTimes(1);
  });

  it("shadow mode logs a match when the saved chart agrees", async () => {
    useStoredRow(storedRow({ lat: 12.2 }));
    await resolveNatalGrounding("shadow-user-2", undefined);
    await vi.waitFor(() => expect(info).toHaveBeenCalledWith(expect.stringMatching(/match user=shadow-u/)));
  });

  it("shadow mode never lets an ephemeris failure reach the user", async () => {
    fetchChart.mockRejectedValue(new Error("Cannot reach ephemeris service at http://internal:8000"));
    useStoredRow(storedRow({ lat: 13.3 }));
    const result = await resolveNatalGrounding("shadow-user-3", undefined);
    expect(result).toMatchObject({ source: "server" });
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(warn.mock.calls[0][0]).not.toContain("internal");
  });

  it("computed mode ignores a tampered saved chart", async () => {
    process.env.CHART_SOURCE_MODE = "computed";
    useStoredRow(storedRow({ ascSignNum: 9, lat: 14.4 }));
    const result = await resolveNatalGrounding("computed-user-1", undefined);
    expect(result).toMatchObject({ source: "computed" });
    expect((result as unknown as { chart: typeof computedChart }).chart.ascendant.sign_num).toBe(4);
  });

  it("computed mode falls back to the saved chart if the ephemeris is down", async () => {
    process.env.CHART_SOURCE_MODE = "computed";
    fetchChart.mockRejectedValue(new Error("down"));
    useStoredRow(storedRow({ lat: 15.5 }));
    const result = await resolveNatalGrounding("computed-user-2", undefined);
    expect(result).toMatchObject({ source: "server" });
  });

  it("computed mode serves a repeat turn from cache", async () => {
    process.env.CHART_SOURCE_MODE = "computed";
    useStoredRow(storedRow({ lat: 16.6 }));
    await resolveNatalGrounding("computed-user-3", undefined);
    await resolveNatalGrounding("computed-user-3", undefined);
    expect(fetchChart).toHaveBeenCalledTimes(1);
  });
});
