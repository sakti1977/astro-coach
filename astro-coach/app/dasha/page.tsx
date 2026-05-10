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
    setProfile(p);
  }, [router]);

  if (!profile?.dashas || !profile?.birthData) return null;

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Vimshottari Dasha Timeline</h1>
          <p className="text-sm text-gray-400 mt-1">
            120-year planetary period cycle based on your Moon nakshatra ({profile.chart?.moon_nakshatra.name})
          </p>
        </div>
        <DashaTimeline dashas={profile.dashas} birthDate={profile.birthData.date} />
      </div>
    </div>
  );
}
