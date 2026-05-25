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
      <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50 px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">✦</span>
            </div>
            <span className="font-bold text-gray-900 tracking-tight">Astro Coach</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              serviceStatus === "ok" ? "bg-green-50 border-green-200 text-green-700"
              : serviceStatus === "down" ? "bg-red-50 border-red-200 text-red-700"
              : "bg-gray-50 border-gray-200 text-gray-500"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                serviceStatus === "ok" ? "bg-green-500"
                : serviceStatus === "down" ? "bg-red-500 animate-pulse"
                : "bg-gray-400 animate-pulse"
              }`} />
              {serviceStatus === "ok" ? "Ready" : serviceStatus === "down" ? "Offline" : "Connecting…"}
            </div>
            {hasProfile && (
              <button onClick={() => router.push("/chart")}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                My chart →
              </button>
            )}
            {session ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-700 text-xs font-semibold">
                    {(session.user.email ?? "?")[0].toUpperCase()}
                  </span>
                </div>
                <button onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="text-xs text-gray-400 hover:text-gray-700">Sign out</button>
              </div>
            ) : (
              <button onClick={() => router.push("/auth/signin")}
                className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-b from-indigo-50/60 to-white border-b border-indigo-100/50">
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span>✦</span> Vedic Jyotish · Swiss Ephemeris Precision
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight leading-tight">
            Your Personal<br />Vedic Astrology Coach
          </h1>
          <p className="text-gray-500 leading-relaxed max-w-lg mx-auto text-base">
            Built on Jyotish — the ancient Indian science of light. Your chart calculated with
            Swiss Ephemeris precision, validated against your real life, and translated into
            practical guidance.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: "⬡", label: "Accurate Chart", desc: "Swiss Ephemeris + Lahiri ayanamsha", color: "bg-blue-50 text-blue-600" },
            { icon: "◎", label: "Life Validated", desc: "Yes/no questions calibrate accuracy", color: "bg-violet-50 text-violet-600" },
            { icon: "✦", label: "AI Coached", desc: "Behavioral guidance, not superstition", color: "bg-indigo-50 text-indigo-600" },
          ].map((f) => (
            <div key={f.label} className="border border-gray-100 rounded-2xl p-5 text-center hover:shadow-md hover:border-gray-200 transition-all">
              <div className={`w-10 h-10 ${f.color} rounded-xl flex items-center justify-center mx-auto mb-3 text-lg`}>
                {f.icon}
              </div>
              <p className="font-semibold text-gray-900 text-sm">{f.label}</p>
              <p className="text-xs text-gray-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Sample insights */}
        <div className="mb-12">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-5">
            What you&apos;ll discover
          </p>
          <div className="space-y-3">
            {[
              { planet: "☽", header: "Moon in Rohini · House 4", body: "Your emotional intelligence is one of your greatest assets. You need a stable, beautiful home environment to feel grounded.", tag: "Personality", tagColor: "bg-blue-50 text-blue-600" },
              { planet: "♃", header: "Jupiter Mahadasha · Active until 2031", body: "This is an expansion phase — the right time to teach, study, or build something with long-term meaning.", tag: "Current Period", tagColor: "bg-amber-50 text-amber-600" },
              { planet: "☉", header: "Sun · 10th House", body: "Career is not just income for you — it is identity. Leadership roles suit you, but only when you have genuine authority.", tag: "Career", tagColor: "bg-green-50 text-green-600" },
            ].map((item) => (
              <div key={item.header} className="border border-gray-100 rounded-2xl p-4 flex gap-4 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                  {item.planet}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{item.header}</p>
                    <span className={`text-xs ${item.tagColor} px-2 py-0.5 rounded-full font-medium`}>{item.tag}</span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-300 mt-4">Sample insights — your chart will reflect your actual birth data</p>
        </div>

        {/* Form */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Calculate your birth chart</h2>
          <p className="text-sm text-gray-400 mb-6">Enter your birth details below — takes under a minute</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text" value={form.name} onChange={(e) => setField("name", e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date of Birth <span className="text-red-400">*</span>
                </label>
                <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Time of Birth <span className="text-red-400">*</span>
                  <span className="text-xs text-gray-400 ml-1">(exact)</span>
                </label>
                <input type="time" value={form.time} onChange={(e) => setField("time", e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Place of Birth <span className="text-red-400">*</span>
                <span className="text-xs text-gray-400 ml-1">— type to search</span>
              </label>
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text" value={form.city} onChange={(e) => onCityChange(e.target.value)}
                  onFocus={() => geoResults.length > 0 && setShowDropdown(true)}
                  placeholder="e.g. Mumbai, Kolkata, London…"
                  autoComplete="off"
                  className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    citySelected ? "border-green-300 bg-green-50" : "border-gray-200"
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {geoLoading ? (
                    <span className="text-gray-400 text-sm animate-spin inline-block">⟳</span>
                  ) : citySelected ? (
                    <span className="text-green-500">✓</span>
                  ) : null}
                </div>
                {showDropdown && geoResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {geoResults.map((r, i) => (
                      <button key={i} type="button" onMouseDown={() => selectResult(r)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 border-b border-gray-50 last:border-0 transition-colors">
                        <p className="font-medium text-gray-900">{r.label}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{r.display_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Latitude", key: "lat" },
                { label: "Longitude", key: "lng" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <input type="number" step="0.0001" value={form[key as "lat" | "lng"]}
                    onChange={(e) => setField(key, e.target.value)} placeholder="auto-filled"
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                <select value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  {ALL_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>

            {!citySelected && form.lat === "" && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
                💡 Type your birth city above — coordinates and timezone fill automatically.
              </div>
            )}

            {serviceStatus === "down" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-medium mb-1">⚠ Ephemeris service is not running</p>
                <p className="text-xs font-mono bg-amber-100 rounded-lg px-3 py-2 mt-2">
                  cd python-service &amp;&amp; uvicorn main:app --port 8000
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || serviceStatus === "down"}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200">
              {loading ? "Calculating your chart…" : "Calculate My Birth Chart →"}
            </button>

            <p className="text-center text-xs text-gray-400">
              🔒 Data stored locally · Nothing shared except chart calculation
            </p>
          </form>
        </div>

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
