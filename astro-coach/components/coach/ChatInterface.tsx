"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, NatalChart, DashaData, CoachingObservation, CoachingPhase } from "@/lib/profile";
import { addChatMessage, buildCoachingContext, getProfile, saveProfile } from "@/lib/profile";
import { storage } from "@/lib/storage";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";

interface Props {
  chart: NatalChart;
  dashas: DashaData;
}

export default function ChatInterface({ chart, dashas }: Props) {
  const profile = getProfile();
  const [messages, setMessages] = useState<ChatMessage[]>(profile.chatHistory.slice(-20));
  const [observations, setObservations] = useState<CoachingObservation[]>([]);
  const [phase, setPhase] = useState<CoachingPhase>(profile.coaching.phase ?? "gathering");
  const [exchangeCount, setExchangeCount] = useState(profile.coaching.exchangeCount ?? 0);
  const [includeReligiousSolutions, setIncludeReligiousSolutions] = useState(
    profile.coaching.includeReligiousSolutions ?? false
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load observations from IndexedDB on mount
  useEffect(() => {
    storage.getObservations().then(setObservations);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleReligiousSolutions() {
    const newValue = !includeReligiousSolutions;
    setIncludeReligiousSolutions(newValue);
    const current = getProfile();
    saveProfile({
      ...current,
      coaching: {
        ...current.coaching,
        includeReligiousSolutions: newValue,
      },
    });
  }

  async function extractAndSave(userMessage: string, assistantResponse: string, currentExchangeCount: number) {
    try {
      const res = await fetch("/api/coach/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage, assistantResponse, exchangeCount: currentExchangeCount }),
      });
      if (!res.ok) return;

      const { observations: extracted, shouldTransitionToRecommending } = (await res.json()) as {
        observations: Array<{ text: string; category: string }>;
        shouldTransitionToRecommending: boolean;
      };

      // Persist new observations to IndexedDB
      const newObs: CoachingObservation[] = [];
      for (const o of extracted) {
        const obs: CoachingObservation = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          text: o.text,
          category: o.category as CoachingObservation["category"],
          exchangeIndex: currentExchangeCount,
        };
        await storage.addObservation(obs);
        newObs.push(obs);
      }

      // Update phase + exchange count in profile (localStorage)
      const newPhase: CoachingPhase =
        shouldTransitionToRecommending ? "recommending" : phase;
      const current = getProfile();
      saveProfile({
        ...current,
        coaching: {
          ...current.coaching,
          exchangeCount: currentExchangeCount,
          phase: newPhase,
          lastUpdated: new Date().toISOString(),
        },
      });

      setPhase(newPhase);
      setExchangeCount(currentExchangeCount);
      if (newObs.length > 0) setObservations((prev) => [...prev, ...newObs]);
    } catch {
      // extraction errors are non-fatal; coaching continues
    }
  }

  async function send() {
    if (!input.trim() || streaming) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    addChatMessage(userMsg);
    const capturedInput = input.trim();
    setInput("");
    setStreaming(true);

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const currentProfile = getProfile();

      const d9AscNum = chart.ascendant.d9_sign_num;
      const d10AscNum = chart.ascendant.d10_sign_num;
      const vargaContext = [
        d9AscNum != null ? `D9 Navamsa Ascendant: ${SIGN_NAMES[d9AscNum]} (soul & relationship nature)` : null,
        d10AscNum != null ? `D10 Dashamsha Ascendant: ${SIGN_NAMES[d10AscNum]} (career & public life)` : null,
        d9AscNum != null && chart.planets.venus
          ? `Venus in D9: ${SIGN_NAMES[chart.planets.venus.d9_sign_num ?? chart.planets.venus.sign_num]} (partner qualities)`
          : null,
        d10AscNum != null && chart.planets.sun
          ? `Sun in D10: ${SIGN_NAMES[chart.planets.sun.d10_sign_num ?? chart.planets.sun.sign_num]} H${(((chart.planets.sun.d10_sign_num ?? chart.planets.sun.sign_num) - d10AscNum + 12) % 12) + 1} (professional identity)`
          : null,
        d10AscNum != null && chart.planets.saturn
          ? `Saturn in D10: ${SIGN_NAMES[chart.planets.saturn.d10_sign_num ?? chart.planets.saturn.sign_num]} (career discipline & obstacles)`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart,
          dashas,
          goals: currentProfile.goals.map((g) => g.description),
          // Observations injected here — survive regardless of message window truncation
          profileContext: buildCoachingContext(currentProfile, observations),
          vargaContext,
          phase,
          includeReligiousSolutions,
          messages: newMessages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: accumulated };
                return copy;
              });
            }
          } catch {}
        }
      }

      const finalMsg: ChatMessage = {
        role: "assistant",
        content: accumulated,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(finalMsg);

      // Extract observations in background — non-blocking, errors are silent
      const nextExchangeCount = exchangeCount + 1;
      extractAndSave(capturedInput, accumulated, nextExchangeCount);
    } catch {
      const errMsg: ChatMessage = {
        role: "assistant",
        content:
          "I encountered an issue connecting to the coaching service. Please check your API key and try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.slice(0, -1), errMsg]);
    } finally {
      setStreaming(false);
    }
  }

  const currentMahaMeta = PLANET_META[dashas.current_maha.toLowerCase() as PlanetKey];

  return (
    <div className="flex flex-col h-full">
      {/* Context bar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50 text-sm">
        <span className="text-xl">{currentMahaMeta?.symbol ?? "●"}</span>
        <span className="text-gray-600">
          <span className="font-medium text-gray-900">{dashas.current_maha}</span> Maha ·{" "}
          <span className="font-medium text-gray-900">{dashas.current_antar}</span> Antar
        </span>
        <span className="ml-auto flex items-center gap-2 text-gray-400">
          {/* Religious solutions toggle */}
          <button
            onClick={toggleReligiousSolutions}
            className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
              includeReligiousSolutions
                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
            title={
              includeReligiousSolutions
                ? "Religious remedies enabled - Click to disable"
                : "Religious remedies disabled - Click to enable"
            }
          >
            {includeReligiousSolutions ? "🕉 Religious" : "⚛ Behavioral"}
          </button>
          {observations.length > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                phase === "recommending"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
              title={
                phase === "recommending"
                  ? `${observations.length} observations gathered — giving recommendations`
                  : `${observations.length} observations gathered — still learning`
              }
            >
              {phase === "recommending" ? "▶ Recommending" : `◎ Gathering (${observations.length})`}
            </span>
          )}
          <span>Lagna: {SIGN_NAMES[chart.ascendant.sign_num]}</span>
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">✦</p>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Your personal Vedic astrology coach is ready. Ask anything about your chart, current period, goals, or life direction.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {[
                "What does my current dasha mean for my career?",
                "What habits should I build right now?",
                "What are my strongest planetary energies?",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-gray-900 text-white rounded-br-sm"
                  : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
              }`}
            >
              {msg.role === "assistant" && msg.content === "" ? (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                </span>
              ) : msg.role === "assistant" ? (
                <div className="chat-markdown text-sm leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={phase === "recommending" ? "Ask for recommendations..." : "Tell me about yourself..."}
            disabled={streaming}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="bg-gray-900 text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
