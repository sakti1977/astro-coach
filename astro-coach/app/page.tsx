"use client";

import JyotishWheel from "@/components/home/JyotishWheel";
import JyotishPrimer from "@/components/home/JyotishPrimer";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Sparkles, Hexagon, Target, Orbit, Lock, Check, Loader2, MapPin, ChevronRight, Compass, LayoutGrid, Lightbulb, AlertTriangle } from "lucide-react";
import { getProfile, updateProfile, clearProfile, archiveProfile, saveProfile, PROFILE_SYNCED_EVENT, type CoachTonePreference, type NatalChart, type DashaData } from "@/lib/profile";
import { parseBackupPayload } from "@/lib/profile-schema";
import { buildDailyTransitNote } from "@/lib/transitNote";
import ConfirmResetModal from "@/components/ConfirmResetModal";
import { storage } from "@/lib/storage-supabase";
import { useDataSync } from "@/lib/useDataSync";
import { PLANET_META, type PlanetKey } from "@/lib/astrology/planets";
import { dignityPhrase } from "@/lib/astrology/dignityFraming";
import { SAMPLE_FOUNDATION } from "@/lib/sampleFoundation";

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
  const { syncToServer, lastSyncedAt, isSyncing, error: syncError } = useDataSync();
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
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [dashas, setDashas] = useState<DashaData | null>(null);
  const [transitNote, setTransitNote] = useState<string | null>(null);
  const [needsValidation, setNeedsValidation] = useState(false);

  // Reads the saved profile into page state. Runs on load and again when a
  // pull from the account lands (a new device starts with nothing local).
  const loadFromProfile = useCallback(() => {
    // Unauthenticated visitors can view this page (hero, features, sample
    // demo) — only submitting birth data requires a session, enforced in
    // handleSubmit per SPEC.md §4.1. getProfile() is purely localStorage-
    // based, so this runs fine for signed-out visitors too.
    const p = getProfile();
    const hasExisting = !!(p.chart && p.dashas);
    queueMicrotask(() => {
      setHasExistingChart(hasExisting);
      setChart(p.chart ?? null);
      setDashas(p.dashas ?? null);
      setTransitNote(buildDailyTransitNote(p.cachedTransits?.data));
      setNeedsValidation(!p.validation?.isValidated);
    });

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

  }, []);

  useEffect(() => {
    if (status === "loading") return;
    loadFromProfile();
    window.addEventListener(PROFILE_SYNCED_EVENT, loadFromProfile);
    return () => window.removeEventListener(PROFILE_SYNCED_EVENT, loadFromProfile);
    // We no longer hard-redirect to /chart — the home page now serves as a useful landing + quick actions when a chart exists.
  }, [status, loadFromProfile]);

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
        const parsed = JSON.parse(ev.target?.result as string);
        const backup = parseBackupPayload(parsed);
        if (!backup.ok) {
          setError(backup.error);
          return;
        }
        saveProfile(backup.value);
        router.push(backup.value.validation?.isValidated ? "/chart" : "/validate");
      } catch {
        setError("Could not read the backup file. Make sure it's a valid JSON backup.");
      }
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // SPEC.md §4.1: chart calculation is allowed anonymously (chart-only
    // guest mode) — /api/chart itself accepts and IP-rate-limits guest
    // requests. Every other feature (coach, Foundation, habits, validation,
    // AI dasha predictions) still requires a session, enforced at those
    // surfaces via <SignInRequired>, not here.

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

  // Signed in on a device with no local chart: the account copy may still be
  // on its way, so don't flash the empty "calculate your chart" form.
  const awaitingCloudProfile =
    status === "authenticated" && !hasExistingChart && !lastSyncedAt && !syncError;

  if (!ready || awaitingCloudProfile) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-8 h-8 mb-4 mx-auto text-indigo-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{awaitingCloudProfile ? "Loading your saved chart…" : "Loading…"}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      {showResetModal && pendingChartData && (
        <ConfirmResetModal
          onArchiveAndReplace={() => applyNewChart(pendingChartData.chart, pendingChartData.dashas, true)}
          onReplaceOnly={() => applyNewChart(pendingChartData.chart, pendingChartData.dashas, false)}
          onCancel={() => { setShowResetModal(false); setPendingChartData(null); }}
        />
      )}
      {/* Header */}
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50 px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-gray-100 tracking-tight">Jyotish Coach</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/trust")}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hidden sm:inline">How we work</button>
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              serviceStatus === "ok" ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
              : serviceStatus === "down" ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
              : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
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
                <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                  <span className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                    {(session.user.email ?? "?")[0].toUpperCase()}
                  </span>
                </div>
                <button onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">Sign out</button>
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
      <div className="bg-gradient-to-b from-indigo-50/60 dark:from-indigo-950/40 to-white dark:to-gray-950 border-b border-indigo-100/50 dark:border-indigo-900/60">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 grid md:grid-cols-[1fr_300px] gap-8 md:gap-10 items-center">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Vedic Jyotish · Swiss Ephemeris Precision
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight leading-tight">
              Your Personal<br />Jyotish Remedy Guide
            </h1>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg mx-auto md:mx-0 text-base">
              Built on Jyotish — the ancient Indian science of light. Your chart calculated with
              Swiss Ephemeris precision, validated against your real life, and worked through with
              mantra, practice, and dharma.
            </p>
            <a href="#what-is-jyotish" className="inline-block mt-5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200">
              New to Jyotish? Start here ↓
            </a>
          </div>
          <JyotishWheel className="w-56 sm:w-64 md:w-full mx-auto drop-shadow-xl" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* Sample Foundation demo — a taste of the real product before the data-entry
            form, shown to first-time visitors (including anonymous ones, now that this
            page no longer hard-redirects signed-out visitors to sign-in). Fully static,
            hand-authored copy — no LLM call, so no cost or abuse surface per visitor. */}
        {!hasExistingChart && ready && (
          <div className="mb-12 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-6 bg-gradient-to-b from-indigo-50/40 dark:from-indigo-950/40 to-white dark:to-gray-950">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Sample reading
              </p>
              <div className="inline-flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full p-1">
                <button
                  type="button"
                  onClick={() => setTonePreference("jyotish")}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    tonePreference === "jyotish" ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  🕉 Traditional
                </button>
                <button
                  type="button"
                  onClick={() => setTonePreference("skeptic")}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    tonePreference === "skeptic" ? "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  🎯 Plain language
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {SAMPLE_FOUNDATION[tonePreference].map((paragraph, i) => (
                <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{paragraph}</p>
              ))}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3 mt-5 pt-4 border-t border-indigo-100 dark:border-indigo-900/60">
              <p className="text-xs text-gray-500 dark:text-gray-400">A fictional sample chart — yours will be entirely about you.</p>
              <a
                href="#birth-form"
                className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                Calculate your real chart →
              </a>
            </div>
          </div>
        )}

        {/* Real chart-derived highlights — deterministic, no LLM call (G1: read-only display of already-computed data) */}
        {hasExistingChart && ready && chart && dashas && (
          <div className="mb-12">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center mb-5">
              Your highlights
            </p>
            <div className="space-y-3">
              {(() => {
                const mahaDignity = dignityPhrase(dashas.lord_dignity?.[dashas.current_maha.toLowerCase()]);
                const items = [
                  {
                    key: "dasha",
                    planet: PLANET_META[dashas.current_maha.toLowerCase() as PlanetKey]?.symbol ?? "●",
                    header: `${dashas.current_maha} Mahadasha / ${dashas.current_antar} Antardasha${dashas.current_pratyantar ? ` / ${dashas.current_pratyantar} Pratyantardasha` : ""}`,
                    body: mahaDignity
                      ? `${dashas.current_maha} is ${mahaDignity} in your chart.`
                      : `Your current planetary period, active until ${new Date(dashas.current_maha_end).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}.`,
                    tag: "Current Period",
                    tagColor: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
                  },
                  chart.planets.moon && chart.moon_nakshatra
                    ? {
                        key: "moon",
                        planet: "☽",
                        header: `Moon in ${chart.planets.moon.sign} · House ${chart.planets.moon.house}`,
                        body: `Your natal Moon sits in ${chart.moon_nakshatra.name} nakshatra — this shapes your emotional baseline and, via Vimshottari, your entire dasha timeline.`,
                    tag: "Personality",
                    tagColor: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
                  }
                    : null,
                  transitNote
                    ? {
                        key: "transit",
                        planet: "♄",
                        header: "Today, from your transits",
                        body: transitNote,
                        tag: "Now",
                        tagColor: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
                      }
                    : null,
                ].filter((x): x is NonNullable<typeof x> => x !== null);
                return items.map((item) => (
                  <div key={item.key} className="border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex gap-4 hover:border-indigo-100 dark:hover:border-indigo-900/60 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/40 transition-all">
                    <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                      {item.planet}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.header}</p>
                        <span className={`text-xs ${item.tagColor} px-2 py-0.5 rounded-full font-medium`}>{item.tag}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Existing chart overview + journey guidance */}
        {hasExistingChart && ready && (
          <div className="mb-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-indigo-500 dark:text-indigo-400 font-semibold">Welcome back</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{form.name || "Your chart"} • {form.city}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your data is ready across Chart, Dasha, Coach, Habits, and more.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => router.push("/chart")} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Open Chart</button>
                <button onClick={() => router.push("/coach")} className="px-4 py-2 text-sm font-medium border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40">Get Guidance</button>
                <button onClick={() => router.push("/profile")} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">Profile &amp; Edit Data</button>
              </div>
            </div>

            {/* Quick next steps */}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recommended next steps</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {needsValidation && (
                  <button onClick={() => router.push("/validate")} className="px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-800/50 font-medium">First: validate this chart against your life</button>
                )}
                <button onClick={() => router.push("/foundation")} className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40">Read your Foundation</button>
                {!needsValidation && (
                  <button onClick={() => router.push("/validate")} className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-900/40">Re-check chart accuracy</button>
                )}
                <button onClick={() => router.push("/habits")} className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40">Generate sadhana for current dasha</button>
                <button onClick={() => router.push("/dasha")} className="px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/60 hover:bg-violet-100 dark:hover:bg-violet-900/40">Explore your dasha timeline</button>
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Hexagon, label: "Accurate Chart", desc: "Swiss Ephemeris + Lahiri ayanamsha", color: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" },
            { icon: Target, label: "Life Validated", desc: "Yes/no questions calibrate accuracy", color: "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" },
            { icon: Sparkles, label: "Behavior-first coaching", desc: "Chart-grounded habits. Ritual remedies are opt-in, never upsold.", color: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400" },
          ].map((f) => (
            <div key={f.label} className="border border-gray-100 dark:border-gray-800 rounded-2xl p-5 text-center hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all">
              <div className={`w-10 h-10 ${f.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                <f.icon className="w-5 h-5" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{f.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>

        <JyotishPrimer />

        {/* Restore from backup — shown only when no chart exists yet (new device / cleared browser) */}
        {!hasExistingChart && ready && (
          <div className="mb-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Have a backup file?</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Restore your chart from a previous export</p>
            </div>
            <label className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 transition-colors whitespace-nowrap">
              ↑ Restore backup
              <input type="file" accept=".json" onChange={importProfile} className="hidden" />
            </label>
          </div>
        )}

        {/* Form */}
        <div id="birth-form" className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {hasExistingChart ? "Update birth details or recalculate" : "Calculate your birth chart"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {hasExistingChart
              ? "Change time, place or name and recalculate. Your previous data can be archived."
              : "Enter your birth details below — takes under a minute"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!hasExistingChart && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">How would you like this framed?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTonePreference("jyotish")}
                    className={`text-left border rounded-xl px-4 py-3 transition-colors ${
                      tonePreference === "jyotish" ? "border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">🕉 Traditional Jyotish</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Karma, dharma, mantra — the full tradition</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTonePreference("skeptic")}
                    className={`text-left border rounded-xl px-4 py-3 transition-colors ${
                      tonePreference === "skeptic" ? "border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">🎯 Just tell me about myself</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Same chart, plain language, no belief required</p>
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">You can switch this anytime from the Coach screen.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
              <input
                type="text" value={form.name} onChange={(e) => setField("name", e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 dark:focus:border-indigo-700 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Date of Birth <span className="text-red-400">*</span>
                </label>
                <input type="date" title="Date of birth" value={form.date} onChange={(e) => setField("date", e.target.value)} required
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Time of Birth <span className="text-red-400">*</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">(as exact as possible)</span>
                </label>
                <input type="time" title="Time of birth" value={form.time} onChange={(e) => setField("time", e.target.value)} required
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-1 mb-1">Tip: Hospital records or a parent’s memory are best. Within 15–30 minutes is usually sufficient — you can refine later with the Validate tool.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Place of Birth <span className="text-red-400">*</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">— type to search or use location</span>
              </label>
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text" value={form.city} onChange={(e) => onCityChange(e.target.value)}
                  onFocus={() => geoResults.length > 0 && setShowDropdown(true)}
                  placeholder="e.g. Mumbai, Kolkata, London…"
                  autoComplete="off"
                  className={`w-full border rounded-xl px-4 py-3 pr-20 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    citySelected ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40" : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {geoLoading ? (
                    <Loader2 className="w-4 h-4 text-gray-500 dark:text-gray-400 animate-spin" />
                  ) : citySelected ? (
                    <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                  ) : null}
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    className="text-[10px] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 flex items-center gap-1"
                    title="Use your device's current location for coordinates"
                  >
                    <MapPin className="w-2.5 h-2.5" /> Current
                  </button>
                </div>
                {showDropdown && geoResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    {geoResults.map((r, i) => (
                      <button key={i} type="button" onMouseDown={() => selectResult(r)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-b border-gray-50 dark:border-gray-900 last:border-0 transition-colors">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{r.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{r.display_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Latitude", key: "lat" },
                { label: "Longitude", key: "lng" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
                  <input type="number" step="0.0001" value={form[key as "lat" | "lng"]}
                    onChange={(e) => setField(key, e.target.value)} placeholder="auto-filled"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-800/50"
                  />
                </div>
              ))}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Timezone</label>
                <select title="Timezone" value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900">
                  {ALL_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>

            {!citySelected && form.lat === "" && (
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-3 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" /> Type your birth city above — coordinates and timezone fill automatically.
              </div>
            )}

            {serviceStatus === "down" && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Ephemeris service is not running</p>
                <p className="text-xs mb-2">The Python calculation service must be running for chart generation.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.open("https://github.com/sakti1977/astro-coach#quick-start", "_blank")}
                    className="text-xs bg-amber-200 dark:bg-amber-800/50 hover:bg-amber-300 dark:hover:bg-amber-700/60 text-amber-900 dark:text-amber-100 px-3 py-1 rounded-lg"
                  >
                    View start.sh instructions
                  </button>
                  <code className="text-[10px] bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded self-center">cd python-service &amp;&amp; uvicorn main:app --port 8000</code>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || serviceStatus === "down"}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200 dark:shadow-black/30">
              {loading ? "Calculating your chart…" : "Calculate My Birth Chart →"}
            </button>

            <p className="text-center text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3 flex-shrink-0" />
              {!session
                ? "Data stored locally on this device · Nothing shared except chart calculation · Sign in to copy it to your account"
                : isSyncing
                ? "Copying this device to your account…"
                : lastSyncedAt
                ? "Copied to your account · Nothing shared except chart calculation"
                : "Signed in — waiting for the first successful account copy"}
            </p>
          </form>
        </div>

        {/* Technical transparency */}
        <details className="mt-12 group">
          <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 text-center list-none flex items-center justify-center gap-1 select-none">
            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
            How the chart is calculated
          </summary>
          <div className="mt-4 border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex gap-3">
              <Hexagon className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Swiss Ephemeris (swe)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Planetary longitudes are computed using the Swiss Ephemeris library — the same engine used by professional Jyotish software. It models gravitational interactions to sub-arc-second precision.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Compass className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Lahiri Ayanamsha</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Vedic astrology uses a sidereal zodiac. The Lahiri ayanamsha (~24°) is subtracted from tropical positions to align planets with their actual constellations — the Government of India&apos;s official standard.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <LayoutGrid className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Whole-sign houses</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Each house spans exactly one sign (30°). The ascendant sign becomes house 1, and houses proceed clockwise. This is the dominant system in classical Jyotish texts.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Orbit className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Vimshottari Dasha</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
