"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import BehaviorRadar from "@/components/habits/BehaviorRadar";
import { getProfile, updateProfile, type UserProfile, type Habit, type Goal } from "@/lib/profile";
import { PLANET_META, type PlanetKey } from "@/lib/astrology/planets";

const GOAL_CATEGORIES = ["career", "health", "relationship", "finance", "spiritual", "creative"] as const;

const RADAR_AXES = [
  { label: "Discipline", planet: "saturn" },
  { label: "Creativity", planet: "venus" },
  { label: "Social", planet: "mercury" },
  { label: "Vitality", planet: "sun" },
  { label: "Wisdom", planet: "jupiter" },
  { label: "Intuition", planet: "moon" },
];

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export default function HabitsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingHabits, setLoadingHabits] = useState(false);
  const [habitError, setHabitError] = useState("");
  const [newGoal, setNewGoal] = useState({ category: "career" as typeof GOAL_CATEGORIES[number], description: "" });
  const [showGoalForm, setShowGoalForm] = useState(false);

  useEffect(() => {
    const p = getProfile();
    if (!p.chart || !p.dashas) { router.push("/"); return; }
    setProfile(p);
  }, [router]);

  function refreshProfile() {
    setProfile(getProfile());
  }

  function toggleHabitToday(habitId: string) {
    const p = getProfile();
    const todayStr = today();
    const habits = p.habits.map((h) => {
      if (h.id !== habitId) return h;
      const doneToday = h.completedDates.includes(todayStr);
      const completedDates = doneToday
        ? h.completedDates.filter((d) => d !== todayStr)
        : [...h.completedDates, todayStr];
      const streak = computeStreak(completedDates);
      return { ...h, completedDates, streak };
    });
    updateProfile({ habits });
    refreshProfile();
  }

  function computeStreak(dates: string[]): number {
    const sorted = [...dates].sort().reverse();
    let streak = 0;
    const d = new Date();
    for (const date of sorted) {
      const expected = d.toISOString().split("T")[0];
      if (date === expected) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function addGoal() {
    if (!newGoal.description.trim()) return;
    const p = getProfile();
    const goal: Goal = {
      id: Date.now().toString(),
      category: newGoal.category,
      description: newGoal.description.trim(),
      createdAt: new Date().toISOString(),
    };
    updateProfile({ goals: [...p.goals, goal] });
    setNewGoal({ category: "career", description: "" });
    setShowGoalForm(false);
    refreshProfile();
  }

  function removeGoal(id: string) {
    const p = getProfile();
    updateProfile({ goals: p.goals.filter((g) => g.id !== id) });
    refreshProfile();
  }

  async function generateHabits() {
    if (!profile?.chart || !profile?.dashas) return;
    setLoadingHabits(true);
    setHabitError("");
    try {
      const weakPlanets = Object.entries(profile.chart.planets)
        .filter(([, p]) => p.retrograde)
        .map(([k]) => k);

      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart: profile.chart,
          dashaLord: profile.dashas.current_maha,
          goals: profile.goals.map((g) => g.description),
          weakPlanets,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Habit generation failed");
      const habits: Habit[] = (data.habits ?? []).map((h: Omit<Habit, "id" | "completedDates" | "streak">) => ({
        ...h,
        id: Math.random().toString(36).slice(2),
        completedDates: [],
        streak: 0,
      }));
      if (habits.length === 0) throw new Error("Claude returned no habits — try again");
      updateProfile({ habits });
      refreshProfile();
    } catch (e: unknown) {
      setHabitError(e instanceof Error ? e.message : "Failed to generate habits");
    } finally {
      setLoadingHabits(false);
    }
  }

  if (!profile) return null;

  const { habits, goals, chart, dashas } = profile;
  const todayStr = today();
  const currentMahaMeta = dashas ? PLANET_META[dashas.current_maha.toLowerCase() as PlanetKey] : null;

  // Radar scores: current = completion rate, prescribed = dasha lord's axis score
  const radarAxes = RADAR_AXES.map((axis) => {
    const relevant = habits.filter((h) => h.planet === axis.planet);
    const completed = relevant.filter((h) => h.completedDates.includes(todayStr)).length;
    const score = relevant.length > 0 ? (completed / relevant.length) * 100 : 20;
    const isDashaLord = axis.planet === dashas?.current_maha.toLowerCase();
    return { label: axis.label, score: Math.round(score), prescribed: isDashaLord ? 90 : 50 };
  });

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Habits & Behavior</h1>
          <p className="text-sm text-gray-400 mt-1">
            Grounded in your {dashas?.current_maha} Maha Dasha · {dashas?.current_antar} Antardasha
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Radar + Goals */}
          <div className="space-y-6">
            {/* Behavior radar */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase mb-4">Behavior Meter</p>
              <div className="flex justify-center">
                <BehaviorRadar axes={radarAxes} size={240} />
              </div>
              {currentMahaMeta && (
                <p className="text-xs text-gray-500 text-center mt-3">
                  Blue zone = what {dashas?.current_maha} Dasha prescribes
                </p>
              )}
            </div>

            {/* Goals */}
            <div className="border border-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-gray-400 uppercase">Your Goals</p>
                <button
                  onClick={() => setShowGoalForm((s) => !s)}
                  className="text-xs text-gray-900 font-medium hover:underline"
                >
                  + Add Goal
                </button>
              </div>

              {showGoalForm && (
                <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
                  <select
                    value={newGoal.category}
                    onChange={(e) => setNewGoal((g) => ({ ...g, category: e.target.value as typeof GOAL_CATEGORIES[number] }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {GOAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Describe your goal..."
                    value={newGoal.description}
                    onChange={(e) => setNewGoal((g) => ({ ...g, description: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addGoal()}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button onClick={addGoal}
                    className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium">
                    Save Goal
                  </button>
                </div>
              )}

              {goals.length === 0 ? (
                <p className="text-sm text-gray-400">No goals yet. Add one to get personalized habit recommendations.</p>
              ) : (
                <div className="space-y-2">
                  {goals.map((g) => (
                    <div key={g.id} className="flex items-start gap-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0">
                        {g.category}
                      </span>
                      <p className="text-sm text-gray-700 flex-1">{g.description}</p>
                      <button onClick={() => removeGoal(g.id)}
                        className="text-gray-300 hover:text-gray-500 text-xs flex-shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Habit tracker */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                Today&apos;s Habits
                <span className="ml-2 text-gray-400 font-normal">
                  {habits.filter((h) => h.completedDates.includes(todayStr)).length}/{habits.length} done
                </span>
              </p>
              <button
                onClick={generateHabits}
                disabled={loadingHabits}
                className="text-sm bg-gray-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loadingHabits ? "Generating..." : habits.length > 0 ? "Refresh Habits" : "Generate Habits →"}
              </button>
            </div>

            {habitError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
                {habitError}
              </div>
            )}

            {habits.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-xl p-12 text-center">
                <p className="text-4xl mb-3">◈</p>
                <p className="text-gray-500 text-sm mb-4">
                  No habits yet. Generate personalized habits based on your {dashas?.current_maha} Dasha and goals.
                </p>
                <button
                  onClick={generateHabits}
                  disabled={loadingHabits}
                  className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {loadingHabits ? "Claude is generating habits..." : "Generate My Habits →"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {habits.map((h) => {
                  const done = h.completedDates.includes(todayStr);
                  const meta = PLANET_META[h.planet?.toLowerCase() as PlanetKey];
                  return (
                    <div key={h.id}
                      className={`border rounded-xl p-4 transition-all ${done ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white"}`}>
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleHabitToday(h.id)}
                          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            done ? "bg-gray-900 border-gray-900 text-white" : "border-gray-300 hover:border-gray-900"
                          }`}
                        >
                          {done && <span className="text-xs">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-medium text-sm ${done ? "line-through text-gray-400" : "text-gray-900"}`}>
                              {h.habit}
                            </p>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              {h.frequency}
                            </span>
                            {meta && (
                              <span className="text-base" title={meta.label}>{meta.symbol}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{h.why}</p>
                          {h.streak > 0 && (
                            <p className="text-xs text-gray-500 mt-1">🔥 {h.streak}-day streak</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 mt-1 capitalize">{h.category}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Weekly summary */}
            {habits.length > 0 && (
              <div className="border border-gray-100 rounded-xl p-5 mt-4">
                <p className="text-xs font-medium text-gray-400 uppercase mb-3">This Week</p>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    const ds = d.toISOString().split("T")[0];
                    const anyDone = habits.some((h) => h.completedDates.includes(ds));
                    const allDone = habits.every((h) => h.completedDates.includes(ds));
                    return (
                      <div key={ds} className="text-center">
                        <div className={`h-8 rounded-md ${allDone ? "bg-gray-900" : anyDone ? "bg-gray-300" : "bg-gray-50 border border-gray-100"}`} />
                        <p className="text-xs text-gray-400 mt-1">
                          {["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
