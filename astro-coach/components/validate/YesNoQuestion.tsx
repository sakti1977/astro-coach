"use client";

import { useState } from "react";
import { PLANET_META, type PlanetKey } from "@/lib/astrology/planets";

interface Question {
  question: string;
  planet: string;
  house: number;
  theme: string;
}

interface Props {
  questions: Question[];
  onComplete: (answers: Array<{ question: Question; answer: boolean }>) => void;
}

export default function YesNoQuestion({ questions, onComplete }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Array<{ question: Question; answer: boolean }>>([]);

  const total = questions.length;
  const current = questions[currentIdx];
  const progress = currentIdx / total;

  function answer(yes: boolean) {
    const next = [...answers, { question: current, answer: yes }];
    setAnswers(next);
    if (currentIdx + 1 >= total) {
      onComplete(next);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }

  const meta = PLANET_META[current?.planet?.toLowerCase() as PlanetKey];

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Question {currentIdx + 1} of {total}</span>
          <span>{Math.round(progress * 100)}% complete</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-900 rounded-full transition-all duration-500"
            style={{ width: `${(currentIdx / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Planet context */}
      {meta && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span className="text-lg">{meta.symbol}</span>
          <span>{meta.label} · House {current.house} · {current.theme}</span>
        </div>
      )}

      {/* Question */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <p className="text-lg font-medium text-gray-900 leading-relaxed">
          {current?.question}
        </p>
      </div>

      {/* Answer buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => answer(false)}
          className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-gray-200 text-gray-700 font-medium text-lg hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition-all active:scale-95"
        >
          <span>✕</span> No
        </button>
        <button
          onClick={() => answer(true)}
          className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-gray-900 bg-gray-900 text-white font-medium text-lg hover:bg-gray-700 transition-all active:scale-95"
        >
          <span>✓</span> Yes
        </button>
      </div>

      {/* Previous answers */}
      {answers.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-medium text-gray-400 uppercase mb-3">Your answers so far</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {[...answers].reverse().map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${a.answer ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {a.answer ? "✓" : "✕"}
                </span>
                <span className="text-gray-600">{a.question.question}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
