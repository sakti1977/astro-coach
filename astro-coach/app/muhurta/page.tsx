"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getProfile, type UserProfile } from "@/lib/profile";
import { Clock } from "lucide-react";

interface PanchangEntry {
  name: string;
  pada?: number;
  is_active_at_sunrise: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface TimingWindow {
  name: string;
  starts_at: string;
  ends_at: string;
  note: string;
}

interface MuhurtaData {
  date: string;
  vara: string;
  vara_lord: string;
  sunrise: string | null;
  sunset: string | null;
  tithi: PanchangEntry[];
  nakshatra: PanchangEntry[];
  yoga: PanchangEntry[];
  karana: PanchangEntry[];
  auspicious: TimingWindow[];
  inauspicious: TimingWindow[];
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function activeEntry(entries: PanchangEntry[]): PanchangEntry | undefined {
  return entries.find((e) => e.is_active_at_sunrise) ?? entries[0];
}

export default function MuhurtaPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dateStr, setDateStr] = useState(todayLocal());
  const [data, setData] = useState<MuhurtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = getProfile();
    if (!p.birthData) { router.push("/"); return; }
    queueMicrotask(() => setProfile(p));

    const birthData = p.birthData;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [year, month, day] = dateStr.split("-").map(Number);
        const res = await fetch("/api/muhurta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year, month, day,
            lat: birthData.lat, lng: birthData.lng, tz_str: birthData.timezone, city: birthData.city,
          }),
        });
        const json = await res.json() as MuhurtaData;
        if (!res.ok) throw new Error((json as unknown as { error?: string }).error ?? "Muhurta fetch failed");
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load muhurta");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [router, dateStr]);

  if (!profile?.birthData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  const tithi = data ? activeEntry(data.tithi) : undefined;
  const nakshatra = data ? activeEntry(data.nakshatra) : undefined;
  const yoga = data ? activeEntry(data.yoga) : undefined;
  const karana = data ? activeEntry(data.karana) : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white">
      <NavBar />
      <div className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Muhurta</h1>
            <p className="text-sm text-gray-400 mt-1">
              Panchang and timing windows for {profile.birthData.city || "your saved location"}
            </p>
          </div>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-20">
            <Clock className="w-9 h-9 mb-3 mx-auto text-indigo-300 animate-pulse" />
            <p className="text-gray-400 text-sm">Calculating panchang…</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Panchang summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Tithi", value: tithi?.name },
                { label: "Nakshatra", value: nakshatra?.name },
                { label: "Yoga", value: yoga?.name },
                { label: "Karana", value: karana?.name },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{item.value ?? "—"}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl p-4">
              <span><span className="font-medium text-gray-600">{data.vara}</span> ({data.vara_lord})</span>
              <span>Sunrise {fmtTime(data.sunrise)}</span>
              <span>Sunset {fmtTime(data.sunset)}</span>
            </div>

            {/* Auspicious windows */}
            <div>
              <h2 className="text-sm font-semibold text-emerald-800 mb-2">Auspicious windows</h2>
              <div className="space-y-2">
                {data.auspicious.map((w) => (
                  <div key={w.name} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-emerald-900">{w.name}</p>
                      <p className="text-xs text-emerald-700 font-medium">{fmtTime(w.starts_at)} – {fmtTime(w.ends_at)}</p>
                    </div>
                    <p className="text-xs text-emerald-800/80 mt-1.5 leading-relaxed">{w.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Inauspicious windows */}
            <div>
              <h2 className="text-sm font-semibold text-amber-800 mb-2">Windows to plan around</h2>
              <div className="space-y-2">
                {data.inauspicious.map((w) => (
                  <div key={w.name} className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-amber-900">{w.name}</p>
                      <p className="text-xs text-amber-700 font-medium">{fmtTime(w.starts_at)} – {fmtTime(w.ends_at)}</p>
                    </div>
                    <p className="text-xs text-amber-800/80 mt-1.5 leading-relaxed">{w.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-300 text-center pt-2">
              Calculated for your saved birth location — update it on your Profile page if you&apos;ve relocated.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
