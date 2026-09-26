"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import AppShell from "@/components/AppShell";
import { getProfile, updateProfile, clearProfile, archiveProfile, type UserProfile } from "@/lib/profile";
import { storage } from "@/lib/storage-supabase";
import { useDataSync } from "@/lib/useDataSync";
import NotificationSettings from "@/components/NotificationSettings";
import ThemeToggle from "@/components/ThemeToggle";
import { UserRound, MessageCircle, Palette, Calculator, Cloud, Bell, Database, KeyRound, type LucideIcon } from "lucide-react";
import CoachPreferences, { readCoachPreferences, saveCoachPreferences, type CoachPreferenceValues } from "@/components/settings/CoachPreferences";
import { Sparkles } from "lucide-react";

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

const SECTIONS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "birth", label: "Birth data", icon: UserRound },
  { id: "coaching", label: "Coaching", icon: MessageCircle },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "chart", label: "Chart", icon: Calculator },
  { id: "sync", label: "Sync", icon: Cloud },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "Your data", icon: Database },
  { id: "account", label: "Account", icon: KeyRound },
];

function SectionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="w-8 h-8 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
      <Icon className="w-4 h-4" />
    </span>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { syncToServer, forceSyncFromServer, isSyncing, lastSyncedAt, error: syncError } = useDataSync();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingBirth, setEditingBirth] = useState(false);
  const [birthForm, setBirthForm] = useState({
    name: "", date: "", time: "", city: "", lat: "", lng: "", timezone: "Asia/Kolkata",
  });
  const [savingBirth, setSavingBirth] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) {
      router.replace("/auth/signin?callbackUrl=/profile");
      return;
    }
    const p = getProfile();
    queueMicrotask(() => {
      setProfile(p);
      if (p.birthData) {
        setBirthForm({
          name: p.birthData.name ?? "",
          date: p.birthData.date ?? "",
          time: p.birthData.time ?? "",
          city: p.birthData.city ?? "",
          lat: p.birthData.lat != null ? String(p.birthData.lat) : "",
          lng: p.birthData.lng != null ? String(p.birthData.lng) : "",
          timezone: p.birthData.timezone ?? "Asia/Kolkata",
        });
      }
    });
  }, [session, authStatus, router]);

  const [coachPrefs, setCoachPrefs] = useState<CoachPreferenceValues>(() => readCoachPreferences());
  function updateCoachPrefs(change: Partial<CoachPreferenceValues>) {
    setCoachPrefs((prev) => ({ ...prev, ...change }));
    saveCoachPreferences(change);
  }

  function refreshProfile() {
    const p = getProfile();
    setProfile(p);
    setCoachPrefs(readCoachPreferences());
  }

  function setField(key: keyof typeof birthForm, val: string) {
    setBirthForm((f) => ({ ...f, [key]: val }));
  }

  async function saveBirthData() {
    if (!birthForm.name || !birthForm.date || !birthForm.time || !birthForm.lat || !birthForm.lng) {
      setMessage({ type: "error", text: "Please fill name, date, time, and location coordinates." });
      return;
    }
    setSavingBirth(true);
    setMessage(null);
    try {
      const lat = parseFloat(birthForm.lat);
      const lng = parseFloat(birthForm.lng);
      if (isNaN(lat) || isNaN(lng)) throw new Error("Invalid coordinates");

      const newBirthData = {
        name: birthForm.name.trim(),
        date: birthForm.date,
        time: birthForm.time,
        city: birthForm.city.trim(),
        lat,
        lng,
        timezone: birthForm.timezone,
      };

      updateProfile({ birthData: newBirthData });
      refreshProfile();
      setEditingBirth(false);
      setMessage({ type: "success", text: "Birth data updated. Recalculate your chart below to apply changes." });
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSavingBirth(false);
    }
  }

  async function recalculateChart(archiveFirst: boolean) {
    if (!profile?.birthData) return;
    setRecalcLoading(true);
    setMessage(null);
    try {
      if (archiveFirst && profile.chart) {
        archiveProfile();
      }

      const bd = profile.birthData;
      const [year, month, day] = bd.date.split("-").map(Number);
      const [hour, minute] = bd.time.split(":").map(Number);

      const res = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bd.name,
          year, month, day, hour, minute,
          lat: bd.lat, lng: bd.lng, tz_str: bd.timezone,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Chart calculation failed");
      }

      const { chart, dashas } = await res.json();

      // Clear old derived data but keep goals/habits/chat if user wants (or archive already done)
      updateProfile({
        chart,
        dashas,
        // Reset validation on new chart
        validation: { questions: [], accuracyScore: 0, confirmedThemes: [], isValidated: false },
        cachedTransits: undefined,
      });

      if (session?.user?.id) {
        try { await syncToServer(); } catch {}
      }

      setMessage({ type: "success", text: "Chart recalculated successfully!" });
      refreshProfile();
      // Navigate to chart after short delay
      setTimeout(() => router.push("/chart"), 900);
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Recalculation failed" });
    } finally {
      setRecalcLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const fullProfile = getProfile();
      const observations = await storage.getObservations();
      const data = { profile: fullProfile, observations, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `astro-coach-export-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: "Data exported." });
    } catch {
      setMessage({ type: "error", text: "Export failed" });
    } finally {
      setExporting(false);
    }
  }

  async function handleClearLocal() {
    if (!confirm("Clear all local data (chart, habits, chat, etc.)? Cloud data (if signed in) will remain until next sync.")) return;
    clearProfile();
    await storage.clearAll();
    refreshProfile();
    setMessage({ type: "success", text: "Local data cleared." });
  }

  async function manualSync(direction: "push" | "pull") {
    try {
      if (direction === "push") {
        await syncToServer();
      } else {
        await forceSyncFromServer();
      }
      refreshProfile();
      setMessage({ type: "success", text: direction === "push" ? "Pushed to cloud." : "Pulled latest from cloud." });
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Sync failed" });
    }
  }

  if (authStatus === "loading" || !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-8 h-8 mb-4 mx-auto text-indigo-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading profile…</p>
        </div>
      </div>
    );
  }

  const bd = profile.birthData;
  const hasChart = !!profile.chart;

  return (
    <AppShell>
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Profile &amp; Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your birth data, sync, and export your information</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 lg:grid lg:grid-cols-[180px_1fr] lg:gap-8">
        {/* Section menu: a long settings page needs a way to jump around. */}
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-6 space-y-0.5">
            {SECTIONS.map((sec) => (
              <li key={sec.id}>
                <a href={`#${sec.id}`} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100">
                  <sec.icon className="w-3.5 h-3.5" /> {sec.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-6 min-w-0">
        {message && (
          <div className={`${message.type === "success" ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"} border rounded-xl p-4 text-sm`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-3 underline text-xs">Dismiss</button>
          </div>
        )}

        {/* Birth Data */}
        <section id="birth" className="scroll-mt-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3"><SectionIcon icon={UserRound} /> Birth Data</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Used for all chart, dasha, and coaching calculations</p>
            </div>
            {!editingBirth && (
              <button
                onClick={() => setEditingBirth(true)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium"
              >
                {bd ? "Edit" : "Add"} birth data
              </button>
            )}
          </div>

          {!bd && !editingBirth && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No birth data yet. <button onClick={() => router.push("/")} className="text-indigo-600 dark:text-indigo-400 underline">Calculate your chart</button></p>
          )}

          {bd && !editingBirth && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><span className="text-gray-500 dark:text-gray-400">Name:</span> <span className="font-medium text-gray-900 dark:text-gray-100">{bd.name}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400">Date:</span> {bd.date}</div>
              <div><span className="text-gray-500 dark:text-gray-400">Time:</span> {bd.time}</div>
              <div><span className="text-gray-500 dark:text-gray-400">Place:</span> {bd.city}</div>
              <div><span className="text-gray-500 dark:text-gray-400">Coordinates:</span> {bd.lat.toFixed(4)}, {bd.lng.toFixed(4)}</div>
              <div><span className="text-gray-500 dark:text-gray-400">Timezone:</span> {bd.timezone}</div>
            </div>
          )}

          {editingBirth && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                  <input type="text" value={birthForm.name} onChange={(e) => setField("name", e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date of Birth</label>
                  <input type="date" value={birthForm.date} onChange={(e) => setField("date", e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Time of Birth (exact)</label>
                  <input type="time" value={birthForm.time} onChange={(e) => setField("time", e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Timezone</label>
                  <select value={birthForm.timezone} onChange={(e) => setField("timezone", e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900">
                    {ALL_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">City / Place</label>
                <input type="text" value={birthForm.city} onChange={(e) => setField("city", e.target.value)} placeholder="Mumbai, London…" className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Latitude</label>
                  <input type="number" step="0.0001" value={birthForm.lat} onChange={(e) => setField("lat", e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Longitude</label>
                  <input type="number" step="0.0001" value={birthForm.lng} onChange={(e) => setField("lng", e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={saveBirthData} disabled={savingBirth} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
                  {savingBirth ? "Saving…" : "Save Birth Data"}
                </button>
                <button onClick={() => { setEditingBirth(false); setMessage(null); }} className="flex-1 border border-gray-200 dark:border-gray-700 py-2.5 rounded-xl text-sm font-medium">Cancel</button>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Changing birth data requires recalculating the chart (below) to see updated positions and predictions.</p>
            </div>
          )}
        </section>

        {/* Coaching preferences — same control as the chat's Settings panel */}
        <section id="coaching" className="scroll-mt-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3"><SectionIcon icon={MessageCircle} /> Coaching</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">How the coach speaks to you. Changes apply from your next message.</p>
          <CoachPreferences value={coachPrefs} onChange={updateCoachPrefs} />
        </section>

        {/* Appearance */}
        <section id="appearance" className="scroll-mt-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3"><SectionIcon icon={Palette} /> Appearance</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">System follows your device&apos;s light or dark setting. Saved on this device.</p>
          <ThemeToggle />
        </section>

        {/* Recalculate Chart */}
        {bd && (
          <section id="chart" className="scroll-mt-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-3"><SectionIcon icon={Calculator} /> Chart Calculation</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Re-run the Swiss Ephemeris calculation with your (updated) birth data.</p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => recalculateChart(true)}
                disabled={recalcLoading}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {recalcLoading ? "Recalculating…" : hasChart ? "Archive old data & Recalculate Chart" : "Calculate Chart"}
              </button>
              {hasChart && (
                <button
                  onClick={() => recalculateChart(false)}
                  disabled={recalcLoading}
                  className="flex-1 border border-gray-200 dark:border-gray-700 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  Recalculate (overwrite current)
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Archiving creates a local backup you can restore from if needed.</p>
          </section>
        )}

        {/* Sync & Cloud */}
        <section id="sync" className="scroll-mt-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3"><SectionIcon icon={Cloud} /> Sync &amp; Cloud Storage</h2>
            <button onClick={() => manualSync("pull")} disabled={isSyncing} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Pull latest</button>
          </div>

          <div className="text-sm space-y-1.5">
            <div>Status: <span className="font-medium">{isSyncing ? "Syncing…" : lastSyncedAt ? "Up to date with cloud" : session ? "Signed in — not yet synced this session" : "Local only (this device)"}</span></div>
            {lastSyncedAt && <div>Last synced: {new Date(lastSyncedAt).toLocaleString()}</div>}
            {syncError && <div className="text-red-600 dark:text-red-400 text-xs">Error: {syncError}</div>}
            {!session && <div className="text-amber-600 dark:text-amber-400 text-xs">Sign in to enable cloud sync across devices.</div>}
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={() => manualSync("push")} disabled={isSyncing || !session} className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg disabled:opacity-50">Push to cloud</button>
            <button onClick={() => manualSync("pull")} disabled={isSyncing || !session} className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg disabled:opacity-50">Pull from cloud</button>
          </div>
        </section>

        <div id="notifications" className="scroll-mt-6">
          <NotificationSettings />
        </div>

        {/* Data Management */}
        <section id="data" className="scroll-mt-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-3"><SectionIcon icon={Database} /> Data Management</h2>

          <div className="space-y-3 text-sm">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full text-left border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl px-4 py-3 flex justify-between items-center"
            >
              <span>Export all my data (JSON)</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{exporting ? "Exporting…" : "Download"}</span>
            </button>

            <button
              onClick={handleClearLocal}
              className="w-full text-left border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 flex justify-between items-center"
            >
              <span>Clear local data only</span>
              <span className="text-xs">Keeps cloud copy</span>
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Your chart, habits, coaching history, and validation data are stored on this device and, when you are signed in, copied to your account through a session-verified API. Cloud writes use a server credential scoped to your user id — not browser row-level security.</p>
        </section>

        {/* Account */}
        <section id="account" className="scroll-mt-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 text-sm">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-3"><SectionIcon icon={KeyRound} /> Account</h2>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Signed in as</div>
              <div className="font-medium">{session?.user?.email || session?.user?.phone || "Unknown"}</div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/auth/signin" })} className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">Sign out</button>
          </div>
        </section>

        <div className="pt-2 text-center">
          <button onClick={() => router.push(hasChart ? "/chart" : "/")} className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200">← Back to {hasChart ? "Chart" : "Home"}</button>
        </div>
        </div>
      </div>
    </AppShell>
  );
}
