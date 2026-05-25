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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white flex flex-col">
      <NavBar />

      {/* Coach header */}
      <div className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200">
              <span className="text-white text-base">✦</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Your Vedic Coach</h1>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5">
                Grounded in your natal chart · Powered by Claude
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/chart")}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors flex items-center gap-1"
          >
            <span>⬡</span> View Chart
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div
        className="flex-1 max-w-3xl mx-auto w-full flex flex-col px-4 pb-0"
        style={{ height: "calc(100vh - 112px)" }}
      >
        <div className="flex-1 overflow-hidden bg-white rounded-t-2xl border border-gray-100 border-b-0 shadow-sm mt-4">
          <ChatInterface chart={profile.chart} dashas={profile.dashas} />
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
