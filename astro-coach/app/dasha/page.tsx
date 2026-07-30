"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
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
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your dasha timeline…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white">
      <NavBar />
      <div className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Vimshottari Dasha Timeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            120-year planetary period cycle based on your Moon nakshatra ({profile.chart?.moon_nakshatra.name})
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <DashaTimeline dashas={profile.dashas} birthDate={profile.birthData.date} />
      </div>
    </div>
  );
}
