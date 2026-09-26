"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DashaTimeline from "@/components/dasha/DashaTimeline";
import { getProfile, type UserProfile } from "@/lib/profile";

export default function DashaPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const p = getProfile();
    if (!p.chart || !p.dashas) { router.push("/"); return; }
    queueMicrotask(() => setProfile(p));
  }, [router]);

  if (!profile?.dashas || !profile?.birthData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 dark:from-indigo-950/40 to-white dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading your dasha timeline…</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Vimshottari Dasha Timeline</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            120-year planetary period cycle based on your Moon nakshatra ({profile.chart?.moon_nakshatra.name})
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <DashaTimeline dashas={profile.dashas} birthDate={profile.birthData.date} />
      </div>
    </AppShell>
  );
}
