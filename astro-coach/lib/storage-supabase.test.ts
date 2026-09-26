import { afterEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage-supabase";
import { getProfile, PROFILE_SYNCED_EVENT } from "./profile";

// Regression: signing in on a new device showed the empty "calculate your
// chart" form, because the home page read the profile before the pull from
// the account landed and never re-read it.
describe("syncFromServer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  function stubServerProfile(chart: unknown) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      profile: {
        birth_data: { name: "A", date: "1990-05-15", time: "06:30", lat: 19, lng: 72, timezone: "Asia/Kolkata", city: "Mumbai" },
        chart,
        dashas: chart ? { current_maha: "Rahu" } : null,
        goals: [], habits: [], chat_history: [], validation: null, coaching: null,
      },
      observations: [],
    }), { status: 200 })));
  }

  it("saves the account's chart on a device with nothing local and tells open pages to reload", async () => {
    stubServerProfile({ ascendant: { sign: "Taurus" } });
    const heard = vi.fn();
    window.addEventListener(PROFILE_SYNCED_EVENT, heard);
    await storage.syncFromServer("u1");
    window.removeEventListener(PROFILE_SYNCED_EVENT, heard);
    expect(getProfile().chart).toEqual({ ascendant: { sign: "Taurus" } });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("never lets an empty account profile overwrite a local chart", async () => {
    localStorage.setItem("astro_coach_profile", JSON.stringify({ ...getProfile(), chart: { ascendant: { sign: "Leo" } } }));
    stubServerProfile(null);
    const heard = vi.fn();
    window.addEventListener(PROFILE_SYNCED_EVENT, heard);
    await storage.syncFromServer("u1");
    window.removeEventListener(PROFILE_SYNCED_EVENT, heard);
    expect(getProfile().chart).toEqual({ ascendant: { sign: "Leo" } });
    expect(heard).not.toHaveBeenCalled();
  });
});
