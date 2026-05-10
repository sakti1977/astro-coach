"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import YesNoQuestion from "@/components/validate/YesNoQuestion";
import { getProfile, updateProfile, type UserProfile } from "@/lib/profile";

interface Question {
  question: string;
  planet: string;
  house: number;
  theme: string;
}

type Phase = "intro" | "loading" | "questions" | "result";

export default function ValidatePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [accuracyScore, setAccuracyScore] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = getProfile();
    if (!p.chart) { router.push("/"); return; }
    setProfile(p);
    if (p.validation.isValidated) setAccuracyScore(p.validation.accuracyScore);
  }, [router]);

  async function startValidation() {
    if (!profile?.chart) return;
    setPhase("loading");
    setError("");
    // Clear any previous answers so re-runs start fresh
    updateProfile({ validation: { questions: [], accuracyScore: 0, confirmedThemes: [], isValidated: false } });
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chart: profile.chart, birthDate: profile.birthData?.date }),
      });
      if (!res.ok) throw new Error("Validation failed");
      const data = await res.json();
      setQuestions(data.questions);
      setPhase("questions");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate questions");
      setPhase("intro");
    }
  }

  function handleComplete(answers: Array<{ question: Question; answer: boolean }>) {
    const yesCount = answers.filter((a) => a.answer).length;
    const finalScore = answers.length > 0 ? yesCount / answers.length : 0;
    setAccuracyScore(finalScore);

    const entries = answers.map(({ question, answer }) => ({
      question: question.question,
      answer,
      planet: question.planet,
      house: question.house,
      theme: question.theme,
    }));

    const confirmedThemes = entries
      .filter((e) => e.answer)
      .map((e) => e.theme)
      .filter((v, i, a) => a.indexOf(v) === i);

    updateProfile({
      validation: {
        questions: entries,
        accuracyScore: finalScore,
        confirmedThemes,
        isValidated: true,
      },
    });

    setPhase("result");
  }

  if (!profile) return null;

  const alreadyValidated = profile.validation.isValidated;

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Chart Validation</h1>
          <p className="text-sm text-gray-400 mt-1">
            Claude Opus analyzes your chart and asks questions to confirm accuracy
          </p>
        </div>

        {phase === "intro" && (
          <div className="space-y-6">
            {alreadyValidated && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
                <p className="text-sm font-medium text-gray-700">Previous validation</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="text-3xl font-bold text-gray-900">
                    {Math.round(profile.validation.accuracyScore * 100)}%
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Chart accuracy score</p>
                    <p className="text-xs text-gray-400">{profile.validation.questions.length} questions answered</p>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-gray-100 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-2">How validation works</h2>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="font-mono text-gray-400">1.</span>Claude Opus (Anthropic&apos;s most capable model) analyzes your birth chart</li>
                <li className="flex gap-2"><span className="font-mono text-gray-400">2.</span>It generates 10 yes/no questions about life events derived from your chart</li>
                <li className="flex gap-2"><span className="font-mono text-gray-400">3.</span>Your answers calibrate the chart interpretation accuracy</li>
                <li className="flex gap-2"><span className="font-mono text-gray-400">4.</span>Future predictions are weighted by this accuracy score</li>
              </ol>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={startValidation}
              className="w-full bg-gray-900 text-white py-4 rounded-xl font-medium text-sm hover:bg-gray-700 transition-colors"
            >
              {alreadyValidated ? "Run Validation Again →" : "Start Chart Validation →"}
            </button>
          </div>
        )}

        {phase === "loading" && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4 animate-pulse">✦</p>
            <p className="text-gray-500">Claude Opus is reading your chart...</p>
            <p className="text-xs text-gray-400 mt-2">This takes about 10–15 seconds</p>
          </div>
        )}

        {phase === "questions" && (
          <YesNoQuestion questions={questions} onComplete={handleComplete} />
        )}

        {phase === "result" && (
          <div className="text-center py-12 space-y-6">
            <div>
              <p className="text-6xl font-bold text-gray-900">
                {Math.round(accuracyScore * 100)}%
              </p>
              <p className="text-gray-500 mt-2">Chart accuracy score</p>
            </div>

            <div className={`rounded-xl p-5 ${accuracyScore >= 0.7 ? "bg-green-50 border border-green-100" : "bg-amber-50 border border-amber-100"}`}>
              {accuracyScore >= 0.7 ? (
                <p className="text-green-800 text-sm">
                  Your chart is well-calibrated. Predictions and coaching will be highly accurate.
                </p>
              ) : (
                <p className="text-amber-800 text-sm">
                  Your chart shows {Math.round(accuracyScore * 100)}% accuracy. This may indicate a slightly different birth time. The coach will still provide valuable guidance based on confirmed placements.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push("/dasha")}
                className="flex-1 border border-gray-200 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                View Dasha Timeline →
              </button>
              <button
                onClick={() => router.push("/coach")}
                className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Talk to Coach →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
