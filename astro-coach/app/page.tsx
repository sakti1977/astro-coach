"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getProfile, updateProfile, clearProfile, archiveProfile, saveProfile, type UserProfile, type CoachTonePreference } from "@/lib/profile";
import ConfirmResetModal from "@/components/ConfirmResetModal";
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
  "Asia/Kolkata", "Asia/Karachi", "Asia/Dhaka", "Asia/Colombo",
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

function normalizeTimezone(timezone: string | null | undefined): string {
  return timezone === "Asia/Mumbai" ? "Asia/Kolkata" : timezone ?? "Asia/Kolkata";
}

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
  const { data: session, status } = useSession();
  const { syncToServer } = useDataSync();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [pendingChartData, setPendingChartData] = useState<{
    chart: import("@/lib/profile").NatalChart;
    dashas: import("@/lib/profile").DashaData;
  } | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("checking");

  const [form, setForm] = useState({
    name: "", date: "", time: "", city: "",
    lat: "", lng: "", timezone: "Asia/Kolkata",
  });
  // SPEC.md §3 — asked once, at onboarding, for first-time charts only.
  // Existing users keep whatever they already chose (changeable in Coach).
  const [tonePreference, setTonePreference] = useState<CoachTonePreference>("jyotish");

  // Geocode state
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [citySelected, setCitySelected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track if user already has a calculated chart (for overview instead of blank redirect)
  const [hasExistingChart, setHasExistingChart] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/auth/signin");
      return;
    }

    const p = getProfile();
    const hasExisting = !!(p.chart && p.dashas);
    queueMicrotask(() => setHasExistingChart(hasExisting));

    if (p.birthData) {
      const bd = p.birthData;
      queueMicrotask(() => {
        setForm({
          name: bd.name ?? "",
          date: bd.date ?? "",
          time: bd.time ?? "",
          city: bd.city ?? "",
          lat: bd.lat != null ? String(bd.lat) : "",
          lng: bd.lng != null ? String(bd.lng) : "",
          timezone: normalizeTimezone(bd.timezone),
        });
        if (bd.lat != null) setCitySelected(true);
        setReady(true);
      });
    } else {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      queueMicrotask(() => {
        if (localTz && ALL_TIMEZONES.includes(localTz)) {
          setForm((f) => ({ ...f, timezone: localTz }));
        }
        setReady(true);
      });
    }

    // We no longer hard-redirect to /chart — the home page now serves as a useful landing + quick actions when a chart exists.
  }, [status, router]);

  // Service health check runs independently of auth state
  useEffect(() => {
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

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        setForm((f) => ({
          ...f,
          lat,
          lng,
          city: f.city || "Current location – please confirm city",
        }));
        setCitySelected(true);
        setGeoLoading(false);
        setShowDropdown(false);
        setGeoResults([]);
        // Gentle hint
        setTimeout(() => {
          if (!form.city || form.city.includes("Current")) {
            // focus city input for user to refine name
          }
        }, 300);
      },
      (err) => {
        setGeoLoading(false);
        setError("Could not get your location. Please type your city instead.");
        console.error(err);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

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

  async function applyNewChart(
    chart: import("@/lib/profile").NatalChart,
    dashas: import("@/lib/profile").DashaData,
    archive: boolean
  ) {
    setLoading(true);
    try {
      if (archive) archiveProfile();
      clearProfile();
      await storage.clearAll();

      const lat = parseFloat(form.lat);
      const lng = parseFloat(form.lng);

      // Tone preference is only set from this form on a genuinely first-time
      // chart — clearProfile() just reset `current` to DEFAULT_PROFILE, so
      // spreading its coaching object here is safe either way, but we only
      // override tonePreference/includeReligiousSolutions when this wasn't
      // an existing user recalculating (their prior choice should stick).
      const current = getProfile();
      const isFirstTimeChart = !hasExistingChart;

      updateProfile({
        birthData: {
          name: form.name, date: form.date, time: form.time,
          lat, lng, timezone: form.timezone, city: form.city,
        },
        chart,
        dashas,
        ...(isFirstTimeChart && {
          coaching: {
            ...current.coaching,
            tonePreference,
            // "Never require ritual buy-in for value" (SPEC.md §3) — skeptic-
            // path users land in behavioral-only by default, not a toggle
            // they have to discover. Still changeable anytime in Coach.
            includeReligiousSolutions: tonePreference === "skeptic" ? false : current.coaching.includeReligiousSolutions,
          },
        }),
      });

      if (session?.user?.id) {
        try { await syncToServer(); } catch (syncError) {
          console.error("Failed to sync to server:", syncError);
        }
      }

      router.push("/chart");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setShowResetModal(false);
      setPendingChartData(null);
    }
  }

  function importProfile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as UserProfile;
        if (!parsed.chart || !parsed.dashas) {
          setError("This file doesn't look like a valid Astro Coach backup.");
          return;
        }
        saveProfile(parsed);
        router.push("/chart");
      } catch {
        setError("Could not read the backup file. Make sure it's a valid JSON backup.");
      }
    };
    reader.readAsText(file);
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

      // BUG-03: if the user has existing chart data, ask before overwriting
      const existing = getProfile();
      if (existing.chart) {
        setPendingChartData({ chart, dashas });
        setShowResetModal(true);
        setLoading(false);
        return; // modal callbacks will call applyNewChart
      }

      // No existing data — apply immediately
      await applyNewChart(chart, dashas, false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-4 text-indigo-400">✦</div>
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {showResetModal && pendingChartData && (
        <ConfirmResetModal
          onArchiveAndReplace={() => applyNewChart(pendingChartData.chart, pendingChartData.dashas, true)}
          onReplaceOnly={() => applyNewChart(pendingChartData.chart, pendingChartData.dashas, false)}
          onCancel={() => { setShowResetModal(false); setPendingChartData(null); }}
        />
      )}
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
            <button onClick={() => router.push("/trust")}
              className="text-xs text-gray-400 hover:text-gray-700 hidden sm:inline">How we work</button>
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
            Your Personal<br />Jyotish Remedy Guide
          </h1>
          <p className="text-gray-500 leading-relaxed max-w-lg mx-auto text-base">
            Built on Jyotish — the ancient Indian science of light. Your chart calculated with
            Swiss Ephemeris precision, validated against your real life, and worked through with
            mantra, practice, and dharma.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: "⬡", label: "Accurate Chart", desc: "Swiss Ephemeris + Lahiri ayanamsha", color: "bg-blue-50 text-blue-600" },
            { icon: "◎", label: "Life Validated", desc: "Yes/no questions calibrate accuracy", color: "bg-violet-50 text-violet-600" },
            { icon: "✦", label: "Remedy & Sadhana", desc: "Mantra, gemstone, and dana matched to your chart", color: "bg-indigo-50 text-indigo-600" },
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

        {/* Existing chart overview + journey guidance */}
        {hasExistingChart && ready && (
          <div className="mb-8 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-indigo-500 font-semibold">Welcome back</p>
                <p className="text-xl font-semibold text-gray-900 mt-0.5">{form.name || "Your chart"} • {form.city}</p>
                <p className="text-sm text-gray-500 mt-1">Your data is ready across Chart, Dasha, Coach, Habits, and more.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => router.push("/chart")} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Open Chart</button>
                <button onClick={() => router.push("/coach")} className="px-4 py-2 text-sm font-medium border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50">Get Guidance</button>
                <button onClick={() => router.push("/profile")} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50">Profile &amp; Edit Data</button>
              </div>
            </div>

            {/* Quick next steps */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Recommended next steps</p>
              <div className="flex flex-wrap gap-2 text-sm">
                <button onClick={() => router.push("/validate")} className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100">Validate chart accuracy</button>
                <button onClick={() => router.push("/habits")} className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100">Generate sadhana for current dasha</button>
                <button onClick={() => router.push("/dasha")} className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100">Explore your dasha timeline</button>
              </div>
            </div>
          </div>
        )}

        {/* Restore from backup — shown only when no chart exists yet (new device / cleared browser) */}
        {!hasExistingChart && ready && (
          <div className="mb-6 border border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Have a backup file?</p>
              <p className="text-xs text-gray-400 mt-0.5">Restore your chart from a previous export</p>
            </div>
            <label className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-2 transition-colors whitespace-nowrap">
              ↑ Restore backup
              <input type="file" accept=".json" onChange={importProfile} className="hidden" />
            </label>
          </div>
        )}

        {/* Form */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {hasExistingChart ? "Update birth details or recalculate" : "Calculate your birth chart"}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {hasExistingChart
              ? "Change time, place or name and recalculate. Your previous data can be archived."
              : "Enter your birth details below — takes under a minute"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!hasExistingChart && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">How would you like this framed?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTonePreference("jyotish")}
                    className={`text-left border rounded-xl px-4 py-3 transition-colors ${
                      tonePreference === "jyotish" ? "border-purple-300 bg-purple-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">🕉 Traditional Jyotish</p>
                    <p className="text-xs text-gray-500 mt-1">Karma, dharma, mantra — the full tradition</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTonePreference("skeptic")}
                    className={`text-left border rounded-xl px-4 py-3 transition-colors ${
                      tonePreference === "skeptic" ? "border-sky-300 bg-sky-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">🎯 Just tell me about myself</p>
                    <p className="text-xs text-gray-500 mt-1">Same chart, plain language, no belief required</p>
                  </button>
                </div>
                <p className="text-xs text-gray-300 mt-2">You can switch this anytime from the Coach screen.</p>
              </div>
            )}
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
                <input type="date" title="Date of birth" value={form.date} onChange={(e) => setField("date", e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Time of Birth <span className="text-red-400">*</span>
                  <span className="text-xs text-gray-400 ml-1">(as exact as possible)</span>
                </label>
                <input type="time" title="Time of birth" value={form.time} onChange={(e) => setField("time", e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-400 -mt-1 mb-1">Tip: Hospital records or a parent’s memory are best. Within 15–30 minutes is usually sufficient — you can refine later with the Validate tool.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Place of Birth <span className="text-red-400">*</span>
                <span className="text-xs text-gray-400 ml-1">— type to search or use location</span>
              </label>
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text" value={form.city} onChange={(e) => onCityChange(e.target.value)}
                  onFocus={() => geoResults.length > 0 && setShowDropdown(true)}
                  placeholder="e.g. Mumbai, Kolkata, London…"
                  autoComplete="off"
                  className={`w-full border rounded-xl px-4 py-3 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    citySelected ? "border-green-300 bg-green-50" : "border-gray-200"
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {geoLoading ? (
                    <span className="text-gray-400 text-sm animate-spin inline-block">⟳</span>
                  ) : citySelected ? (
                    <span className="text-green-500">✓</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    className="text-[10px] px-2 py-0.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 active:bg-gray-100"
                    title="Use your device's current location for coordinates"
                  >
                    📍 Current
                  </button>
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
                <select title="Timezone" value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}
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
                <p className="text-xs mb-2">The Python calculation service must be running for chart generation.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.open("https://github.com", "_blank")}
                    className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1 rounded-lg"
                  >
                    View start.sh instructions
                  </button>
                  <code className="text-[10px] bg-amber-100 px-2 py-1 rounded self-center">cd python-service &amp;&amp; uvicorn main:app --port 8000</code>
                </div>
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
              {session
                ? "🔒 Synced to your account · Nothing shared except chart calculation"
                : "🔒 Data stored locally on this device · Nothing shared except chart calculation · Sign in to sync across devices"}
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
