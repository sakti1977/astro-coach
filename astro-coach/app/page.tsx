"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getProfile, updateProfile, clearProfile } from "@/lib/profile";
import { storage } from "@/lib/storage-supabase";
import { useDataSync } from "@/lib/useDataSync";

// IANA timezone guesses by country code (best-effort for common countries)
const COUNTRY_TZ: Record<string, string> = {
  IN: "Asia/Kolkata", US: "America/New_York", GB: "Europe/London",
  AU: "Australia/Sydney", AE: "Asia/Dubai", SG: "Asia/Singapore",
  DE: "Europe/Berlin", FR: "Europe/Paris", JP: "Asia/Tokyo",
  CN: "Asia/Shanghai", PK: "Asia/Karachi", BD: "Asia/Dhaka",
  NZ: "Pacific/Auckland", CA: "America/Toronto", ZA: "Africa/Johannesburg",
  BR: "America/Sao_Paulo", MX: "America/Mexico_City", RU: "Europe/Moscow",
  NL: "Europe/Amsterdam", IT: "Europe/Rome", ES: "Europe/Madrid",
  KE: "Africa/Nairobi", NG: "Africa/Lagos", EG: "Africa/Cairo",
  SA: "Asia/Riyadh", IR: "Asia/Tehran", TH: "Asia/Bangkok",
  ID: "Asia/Jakarta", MY: "Asia/Kuala_Lumpur", PH: "Asia/Manila",
  LK: "Asia/Colombo", NP: "Asia/Kathmandu", MM: "Asia/Rangoon",
};

const ALL_TIMEZONES = [
  "Asia/Kolkata", "Asia/Mumbai", "Asia/Karachi", "Asia/Dhaka", "Asia/Colombo",
  "Asia/Kathmandu", "Asia/Rangoon", "Asia/Bangkok", "Asia/Jakarta",
  "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Manila", "Asia/Shanghai",
  "Asia/Tokyo", "Asia/Dubai", "Asia/Tehran", "Asia/Riyadh",
  "Africa/Cairo", "Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam",
  "Europe/Rome", "Europe/Madrid", "Europe/Moscow",
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo",
  "America/Mexico_City", "Australia/Sydney", "Australia/Perth",
  "Pacific/Auckland", "Pacific/Honolulu",
];

type ServiceStatus = "checking" | "ok" | "down";

interface GeoResult {
  label: string;
  display_name: string;
  lat: number;
  lng: number;
  country_code: string;
}

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { syncToServer } = useDataSync();
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("checking");

  const [form, setForm] = useState({
    name: "", date: "", time: "", city: "",
    lat: "", lng: "", timezone: "Asia/Kolkata",
  });

  // Geocode state
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [citySelected, setCitySelected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = getProfile();
    if (p.chart && p.dashas) setHasProfile(true);

    // Pre-fill form for returning users
    if (p.birthData) {
      const bd = p.birthData;
      setForm({
        name: bd.name ?? "",
        date: bd.date ?? "",
        time: bd.time ?? "",
        city: bd.city ?? "",
        lat: bd.lat != null ? String(bd.lat) : "",
        lng: bd.lng != null ? String(bd.lng) : "",
        timezone: bd.timezone ?? "Asia/Kolkata",
      });
      if (bd.lat != null) setCitySelected(true);
    } else {
      // First visit: default to local timezone
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (localTz && ALL_TIMEZONES.includes(localTz)) {
        setForm((f) => ({ ...f, timezone: localTz }));
      }
    }

    // Check ephemeris service health via Next.js proxy
    async function checkService() {
      try {
        const res = await fetch("/api/health", { signal: AbortSignal.timeout(5000) });
        setServiceStatus(res.ok ? "ok" : "down");
      } catch {
        setServiceStatus("down");
      }
    }
    checkService();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchCity = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setGeoResults([]); setShowDropdown(false); return; }
    setGeoLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setGeoResults(data.results ?? []);
      setShowDropdown((data.results ?? []).length > 0);
    } catch {
      setGeoResults([]);
    } finally {
      setGeoLoading(false);
    }
  }, []);

  function onCityChange(val: string) {
    setForm((f) => ({ ...f, city: val }));
    setCitySelected(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCity(val), 400);
  }

  function selectResult(r: GeoResult) {
    const tz = COUNTRY_TZ[r.country_code] ?? form.timezone;
    setForm((f) => ({
      ...f,
      city: r.label,
      lat: r.lat.toFixed(4),
      lng: r.lng.toFixed(4),
      timezone: tz,
    }));
    setCitySelected(true);
    setShowDropdown(false);
    setGeoResults([]);
  }

  function setField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name || !form.date || !form.time || !form.lat || !form.lng) {
      setError("Please fill in all required fields including birth location.");
      return;
    }

    const [year, month, day] = form.date.split("-").map(Number);
    const [hour, minute] = form.time.split(":").map(Number);
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);

    if (isNaN(lat) || isNaN(lng)) {
      setError("Invalid coordinates. Please search for your birth city again.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, year, month, day, hour, minute, lat, lng, tz_str: form.timezone }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Chart calculation failed");
      }

      const { chart, dashas } = await res.json();

      // Clear all previous data when new kundli is entered
      clearProfile();
      await storage.clearAll();

      // Save fresh profile with new birth data only
      updateProfile({
        birthData: { name: form.name, date: form.date, time: form.time, lat, lng, timezone: form.timezone, city: form.city },
        chart,
        dashas,
      });

      // Sync to server if authenticated
      if (session?.user?.id) {
        try {
          await syncToServer();
        } catch (syncError) {
          console.error("Failed to sync to server:", syncError);
          // Don't block navigation on sync failure
        }
      }

      router.push("/chart");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✦</span>
            <span className="font-semibold text-gray-900 tracking-tight">Astro Coach</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Ephemeris service status pill */}
            <div
              title={
                serviceStatus === "checking"
                  ? "Connecting to ephemeris calculation engine…"
                  : serviceStatus === "ok"
                  ? "Swiss Ephemeris engine is running and ready"
                  : "Ephemeris engine offline — run ./start.sh to start it"
              }
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border cursor-default select-none ${
                serviceStatus === "ok"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : serviceStatus === "down"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                serviceStatus === "ok"
                  ? "bg-green-500"
                  : serviceStatus === "down"
                  ? "bg-red-500 animate-pulse"
                  : "bg-gray-400 animate-pulse"
              }`} />
              {serviceStatus === "ok"
                ? "Ephemeris ready"
                : serviceStatus === "down"
                ? "Engine offline"
                : "Connecting…"}
            </div>
            {hasProfile && (
              <button onClick={() => router.push("/chart")}
                className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2">
                View my chart →
              </button>
            )}
            {/* User menu */}
            {session ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{session.user.email}</span>
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth/signin")}
                className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-5xl mb-4">✦</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
            Your Personal Vedic Astrology Coach
          </h1>
          <p className="text-gray-500 leading-relaxed max-w-lg mx-auto">
            Built on Jyotish — the ancient Indian science of light. Your chart is calculated with
            Swiss Ephemeris precision, validated against your real life, and translated into
            practical guidance for who you&apos;re becoming.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: "⬡", label: "Accurate Chart", desc: "Swiss Ephemeris + Lahiri ayanamsha" },
            { icon: "◎", label: "Life Validated", desc: "Yes/no questions calibrate accuracy" },
            { icon: "✦", label: "AI Coached", desc: "Behavioral guidance, not superstition" },
          ].map((f) => (
            <div key={f.label} className="border border-gray-100 rounded-xl p-4 text-center">
              <p className="text-2xl mb-2">{f.icon}</p>
              <p className="font-medium text-gray-900 text-sm">{f.label}</p>
              <p className="text-xs text-gray-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Sample insights preview */}
        <div className="mb-12">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-5">
            What you&apos;ll discover
          </p>
          <div className="space-y-3">
            {[
              {
                planet: "☽",
                header: "Moon in Rohini · House 4",
                body: "Your emotional intelligence is one of your greatest assets. You need a stable, beautiful home environment to feel grounded — disruptions there hit you harder than most people realize.",
                tag: "Personality",
              },
              {
                planet: "♃",
                header: "Jupiter Mahadasha · Active until 2031",
                body: "This is an expansion phase — the right time to teach, study, or build something with long-term meaning. Financial growth tends to arrive through reputation, not hustle.",
                tag: "Current Period",
              },
              {
                planet: "☉",
                header: "Sun · 10th House",
                body: "Career is not just income for you — it is identity. Leadership roles suit you, but only when you have genuine authority. Working under micromanagers drains your life force.",
                tag: "Career",
              },
            ].map((item) => (
              <div key={item.header} className="border border-gray-100 rounded-xl p-4 flex gap-4">
                <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{item.planet}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{item.header}</p>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{item.tag}</span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-300 mt-4">Sample insights — your chart will reflect your actual birth data</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text" value={form.name} onChange={(e) => setField("name", e.target.value)}
              placeholder="Your name"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date" value={form.date} onChange={(e) => setField("date", e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time of Birth <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 ml-1">(exact)</span>
              </label>
              <input
                type="time" value={form.time} onChange={(e) => setField("time", e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          {/* City search — fills lat/lng automatically */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Place of Birth <span className="text-red-500">*</span>
              <span className="text-xs text-gray-400 ml-1">(type to search)</span>
            </label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => onCityChange(e.target.value)}
                  onFocus={() => geoResults.length > 0 && setShowDropdown(true)}
                  placeholder="e.g. Mumbai, Kolkata, London..."
                  autoComplete="off"
                  className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors ${
                    citySelected
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200"
                  }`}
                />
                {/* Status icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {geoLoading ? (
                    <span className="text-gray-400 text-sm animate-spin inline-block">⟳</span>
                  ) : citySelected ? (
                    <span className="text-green-500 text-sm">✓</span>
                  ) : form.city.length >= 2 ? (
                    <span className="text-gray-300 text-xs">search</span>
                  ) : null}
                </div>
              </div>

              {/* Dropdown results */}
              {showDropdown && geoResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {geoResults.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => selectResult(r)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <p className="font-medium text-gray-900">{r.label}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{r.display_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coordinates (auto-filled, but editable) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number" step="0.0001" value={form.lat}
                onChange={(e) => setField("lat", e.target.value)}
                placeholder="auto-filled"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number" step="0.0001" value={form.lng}
                onChange={(e) => setField("lng", e.target.value)}
                placeholder="auto-filled"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                {ALL_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hint */}
          {!citySelected && form.lat === "" && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              Type your birth city above — latitude, longitude, and timezone will fill automatically.
            </div>
          )}

          {serviceStatus === "down" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">⚠ Ephemeris service is not running</p>
              <p className="text-xs text-amber-700 font-mono bg-amber-100 rounded-lg px-3 py-2 mt-2">
                cd python-service &amp;&amp; uvicorn main:app --port 8000
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Or run <code className="bg-amber-100 px-1 rounded">./start.sh</code> from the project root.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 whitespace-pre-line">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading || serviceStatus === "down"}
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-medium text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Calculating your chart..." : "Calculate My Birth Chart →"}
          </button>

          <p className="text-center text-xs text-gray-400">
            All data stored locally in your browser. Nothing leaves your device except for chart calculation.
          </p>
        </form>

        {/* Technical transparency */}
        <details className="mt-12 group">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 text-center list-none flex items-center justify-center gap-1 select-none">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            How the chart is calculated
          </summary>
          <div className="mt-4 border border-gray-100 rounded-xl p-5 space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <span className="text-base flex-shrink-0">⬡</span>
              <div>
                <p className="font-medium text-gray-800">Swiss Ephemeris (swe)</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Planetary longitudes are computed using the Swiss Ephemeris library — the same engine used by professional Jyotish software. It models gravitational interactions to sub-arc-second precision.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-base flex-shrink-0">◎</span>
              <div>
                <p className="font-medium text-gray-800">Lahiri Ayanamsha</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Vedic astrology uses a sidereal zodiac. The Lahiri ayanamsha (~24°) is subtracted from tropical positions to align planets with their actual constellations — the Government of India&apos;s official standard.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-base flex-shrink-0">✦</span>
              <div>
                <p className="font-medium text-gray-800">Whole-sign houses</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Each house spans exactly one sign (30°). The ascendant sign becomes house 1, and houses proceed clockwise. This is the dominant system in classical Jyotish texts.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-base flex-shrink-0">◑</span>
              <div>
                <p className="font-medium text-gray-800">Vimshottari Dasha</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  The timing system is calculated from the Moon&apos;s nakshatra at birth. The 120-year cycle (Ketu → Venus → Sun → … → Mercury) is divided into major periods (Maha) and sub-periods (Antardasha).
                </p>
              </div>
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}
