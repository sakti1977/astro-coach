"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import NavBar from "@/components/NavBar";
import { getProfile, updateProfile, clearProfile, archiveProfile, type UserProfile } from "@/lib/profile";
import { storage } from "@/lib/storage-supabase";
import { useDataSync } from "@/lib/useDataSync";
import NotificationSettings from "@/components/NotificationSettings";
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

  function refreshProfile() {
    const p = getProfile();
    setProfile(p);
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-8 h-8 mb-4 mx-auto text-indigo-400" />
          <p className="text-sm text-gray-500">Loading profile…</p>
        </div>
      </div>
    );
  }

  const bd = profile.birthData;
  const hasChart = !!profile.chart;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white">
      <NavBar />

      <div className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Profile &amp; Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your birth data, sync, and export your information</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {message && (
          <div className={`${message.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"} border rounded-xl p-4 text-sm`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-3 underline text-xs">Dismiss</button>
          </div>
        )}

        {/* Birth Data */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Birth Data</h2>
              <p className="text-xs text-gray-500">Used for all chart, dasha, and coaching calculations</p>
            </div>
            {!editingBirth && (
              <button
                onClick={() => setEditingBirth(true)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {bd ? "Edit" : "Add"} birth data
              </button>
            )}
          </div>

          {!bd && !editingBirth && (
            <p className="text-sm text-gray-500">No birth data yet. <button onClick={() => router.push("/")} className="text-indigo-600 underline">Calculate your chart</button></p>
          )}

          {bd && !editingBirth && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-900">{bd.name}</span></div>
              <div><span className="text-gray-500">Date:</span> {bd.date}</div>
              <div><span className="text-gray-500">Time:</span> {bd.time}</div>
              <div><span className="text-gray-500">Place:</span> {bd.city}</div>
              <div><span className="text-gray-500">Coordinates:</span> {bd.lat.toFixed(4)}, {bd.lng.toFixed(4)}</div>
              <div><span className="text-gray-500">Timezone:</span> {bd.timezone}</div>
            </div>
          )}

          {editingBirth && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input type="text" value={birthForm.name} onChange={(e) => setField("name", e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
                  <input type="date" value={birthForm.date} onChange={(e) => setField("date", e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time of Birth (exact)</label>
                  <input type="time" value={birthForm.time} onChange={(e) => setField("time", e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
                  <select value={birthForm.timezone} onChange={(e) => setField("timezone", e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white">
                    {ALL_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City / Place</label>
                <input type="text" value={birthForm.city} onChange={(e) => setField("city", e.target.value)} placeholder="Mumbai, London…" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                  <input type="number" step="0.0001" value={birthForm.lat} onChange={(e) => setField("lat", e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                  <input type="number" step="0.0001" value={birthForm.lng} onChange={(e) => setField("lng", e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={saveBirthData} disabled={savingBirth} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
                  {savingBirth ? "Saving…" : "Save Birth Data"}
                </button>
                <button onClick={() => { setEditingBirth(false); setMessage(null); }} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium">Cancel</button>
              </div>
              <p className="text-[10px] text-gray-500">Changing birth data requires recalculating the chart (below) to see updated positions and predictions.</p>
            </div>
          )}
        </div>

        {/* Recalculate Chart */}
        {bd && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Chart Calculation</h2>
            <p className="text-sm text-gray-500 mb-4">Re-run the Swiss Ephemeris calculation with your (updated) birth data.</p>

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
                  className="flex-1 border border-gray-200 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  Recalculate (overwrite current)
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Archiving creates a local backup you can restore from if needed.</p>
          </div>
        )}

        {/* Sync & Cloud */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Sync &amp; Cloud Storage</h2>
            <button onClick={() => manualSync("pull")} disabled={isSyncing} className="text-xs text-indigo-600 hover:underline">Pull latest</button>
          </div>

          <div className="text-sm space-y-1.5">
            <div>Status: <span className="font-medium">{isSyncing ? "Syncing…" : lastSyncedAt ? "Up to date with cloud" : "Local only (no Supabase)"}</span></div>
            {lastSyncedAt && <div>Last synced: {new Date(lastSyncedAt).toLocaleString()}</div>}
            {syncError && <div className="text-red-600 text-xs">Error: {syncError}</div>}
            {!session && <div className="text-amber-600 text-xs">Sign in to enable cloud sync across devices.</div>}
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={() => manualSync("push")} disabled={isSyncing || !session} className="text-sm bg-white border border-gray-200 px-4 py-2 rounded-lg disabled:opacity-50">Push to cloud</button>
            <button onClick={() => manualSync("pull")} disabled={isSyncing || !session} className="text-sm bg-white border border-gray-200 px-4 py-2 rounded-lg disabled:opacity-50">Pull from cloud</button>
          </div>
        </div>

        <NotificationSettings />

        {/* Data Management */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Data Management</h2>

          <div className="space-y-3 text-sm">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full text-left border border-gray-200 hover:bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center"
            >
              <span>Export all my data (JSON)</span>
              <span className="text-xs text-gray-500">{exporting ? "Exporting…" : "Download"}</span>
            </button>

            <button
              onClick={handleClearLocal}
              className="w-full text-left border border-red-200 hover:bg-red-50 text-red-700 rounded-xl px-4 py-3 flex justify-between items-center"
            >
              <span>Clear local data only</span>
              <span className="text-xs">Keeps cloud copy</span>
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">Your chart, habits, coaching history, and validation data are stored locally and (when signed in) synced to Supabase with row-level security.</p>
        </div>

        {/* Account */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 text-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Account</h2>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-gray-500 text-xs">Signed in as</div>
              <div className="font-medium">{session?.user?.email || session?.user?.phone || "Unknown"}</div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/auth/signin" })} className="text-xs text-red-600 hover:text-red-700">Sign out everywhere</button>
          </div>
        </div>

        <div className="pt-2 text-center">
          <button onClick={() => router.push(hasChart ? "/chart" : "/")} className="text-sm text-indigo-600 hover:text-indigo-800">← Back to {hasChart ? "Chart" : "Home"}</button>
        </div>
      </div>
    </div>
  );
}
