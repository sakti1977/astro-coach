"use client";

import ProtectedRoute from "@/components/ProtectedRoute";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import ChatInterface from "@/components/coach/ChatInterface";
import { getProfile, type UserProfile } from "@/lib/profile";

export default function CoachPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const p = getProfile();
    if (!p.chart || !p.dashas) { router.push("/"); return; }
    setProfile(p);
  }, [router]);

  if (!profile?.chart || !profile?.dashas) return null;

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-white flex flex-col">
      <NavBar />
      <div className="flex-1 max-w-3xl mx-auto w-full flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
        <div className="px-4 pt-6 pb-3">
          <h1 className="text-xl font-bold text-gray-900">Your Vedic Coach</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Grounded in your natal chart · Powered by Claude · Locally stored
          </p>
        </div>
        <div className="flex-1 overflow-hidden border border-gray-100 rounded-t-2xl mx-4 mb-0">
          <ChatInterface chart={profile.chart} dashas={profile.dashas} />
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
