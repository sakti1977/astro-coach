"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Sparkles, RotateCcw, Zap, CheckCircle2, PlayCircle, CircleDot, Loader2, Pause, Volume2, Mic, Square } from "lucide-react";
import type { ChatMessage, NatalChart, DashaData, CoachingObservation, CoachingPhase, CoachTonePreference, CachedTransits } from "@/lib/profile";
import { addChatMessage, buildCoachingContext, getProfile, saveProfile } from "@/lib/profile";
import { storage } from "@/lib/storage-supabase";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";
import { buildTransitContext } from "@/lib/astrology/prompts";
import { SARVAM_LANGUAGES, DEFAULT_LANGUAGE_CODE } from "@/lib/languages";
import {
  CHAT_HISTORY_DISPLAY,
  CHAT_WINDOW_API,
  EXTRACT_MIN_USER_CHARS,
  EXTRACT_MIN_ASST_CHARS,
  TRANSIT_TTL_MS,
} from "@/lib/constants";

async function translateViaApi(text: string, sourceLanguageCode: string, targetLanguageCode: string): Promise<string> {
  if (!text.trim() || sourceLanguageCode === targetLanguageCode) return text;
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceLanguageCode, targetLanguageCode }),
  });
  if (!res.ok) throw new Error(`Translation failed (${res.status})`);
  const { translatedText } = await res.json();
  return translatedText as string;
}

interface Props {
  chart: NatalChart;
  dashas: DashaData;
}

export default function ChatInterface({ chart, dashas }: Props) {
  const profile = getProfile();
  const [messages, setMessages] = useState<ChatMessage[]>(profile.chatHistory.slice(-CHAT_HISTORY_DISPLAY));
  const [observations, setObservations] = useState<CoachingObservation[]>([]);
  const [phase, setPhase] = useState<CoachingPhase>(profile.coaching.phase ?? "gathering");
  const [exchangeCount, setExchangeCount] = useState(profile.coaching.exchangeCount ?? 0);
  const [planDelivered, setPlanDelivered] = useState(profile.coaching.planDelivered ?? false);
  const [includeReligiousSolutions, setIncludeReligiousSolutions] = useState(
    profile.coaching.includeReligiousSolutions ?? true
  );
  const [tonePreference, setTonePreference] = useState<CoachTonePreference>(
    profile.coaching.tonePreference ?? "jyotish"
  );
  const [preferredLanguage, setPreferredLanguage] = useState(
    profile.coaching.preferredLanguage ?? DEFAULT_LANGUAGE_CODE
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [transitContext, setTransitContext] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [loadingAudioIndex, setLoadingAudioIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);

  function changeLanguage(code: string) {
    setPreferredLanguage(code);
    const current = getProfile();
    saveProfile({
      ...current,
      coaching: { ...current.coaching, preferredLanguage: code },
    });
  }

  // Load observations from IndexedDB on mount
  useEffect(() => {
    storage.getObservations().then(setObservations);
  }, []);

  // Fetch or restore cached transits (2hr TTL)
  useEffect(() => {
    async function loadTransits() {
      const p = getProfile();
      const cached = p.cachedTransits;
      const natalMoonSign = chart.planets.moon?.sign_num ?? 0;
      const tzStr = p.birthData?.timezone ?? "UTC";

      if (cached && cached.tzStr === tzStr && Date.now() - new Date(cached.cachedAt).getTime() < TRANSIT_TTL_MS) {
        setTransitContext(buildTransitContext(cached.data));
        return;
      }

      try {
        const res = await fetch("/api/transits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            natal_asc_sign_num: chart.ascendant.sign_num,
            natal_moon_sign_num: natalMoonSign,
            tz_str: tzStr,
          }),
        });
        if (!res.ok) return;
        const data: CachedTransits["data"] = await res.json();
        const fresh: CachedTransits = { data, cachedAt: new Date().toISOString(), tzStr };
        const current = getProfile();
        saveProfile({ ...current, cachedTransits: fresh });
        setTransitContext(buildTransitContext(data));
      } catch {
        // Non-critical — coaching works without transit context
      }
    }
    loadTransits();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function toggleTonePreference() {
    const newValue: CoachTonePreference = tonePreference === "jyotish" ? "skeptic" : "jyotish";
    setTonePreference(newValue);
    const current = getProfile();
    saveProfile({
      ...current,
      coaching: {
        ...current.coaching,
        tonePreference: newValue,
      },
    });
  }

  function startNewTopic() {
    // Reset conversation state — keep chart, profile, and observations (accumulated context)
    setMessages([]);
    setPhase("gathering");
    setExchangeCount(0);
    setPlanDelivered(false);
    const current = getProfile();
    saveProfile({
      ...current,
      chatHistory: [],
      coaching: {
        ...current.coaching,
        phase: "gathering",
        exchangeCount: 0,
        planDelivered: false,
        lastUpdated: new Date().toISOString(),
      },
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function toggleRecording() {
    setVoiceError("");

    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          form.append("languageCode", preferredLanguage === DEFAULT_LANGUAGE_CODE ? "unknown" : preferredLanguage);

          const res = await fetch("/api/speech-to-text", { method: "POST", body: form });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Could not transcribe audio");
          }
          const { transcript } = await res.json();
          if (transcript?.trim()) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        } catch (e: unknown) {
          setVoiceError(e instanceof Error ? e.message : "Voice input failed");
        } finally {
          setTranscribing(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setVoiceError("Microphone access denied or unavailable");
    }
  }

  function stopPlayback() {
    audioPlayerRef.current?.pause();
    audioQueueRef.current = [];
    setPlayingIndex(null);
  }

  function playNextClip(index: number) {
    const next = audioQueueRef.current.shift();
    if (!next) {
      setPlayingIndex(null);
      return;
    }
    if (!audioPlayerRef.current) audioPlayerRef.current = new Audio();
    const player = audioPlayerRef.current;
    player.src = `data:audio/mp3;base64,${next}`;
    player.onended = () => playNextClip(index);
    player.play().catch(() => setPlayingIndex(null));
  }

  async function toggleListen(index: number, text: string) {
    setVoiceError("");

    if (playingIndex === index) {
      stopPlayback();
      return;
    }
    stopPlayback();
    setLoadingAudioIndex(index);
    try {
      const res = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguageCode: preferredLanguage }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not generate audio");
      }
      const { audioClips } = (await res.json()) as { audioClips: string[] };
      if (!audioClips?.length) throw new Error("No audio returned");
      audioQueueRef.current = audioClips.slice(1);
      setPlayingIndex(index);
      if (!audioPlayerRef.current) audioPlayerRef.current = new Audio();
      const player = audioPlayerRef.current;
      player.src = `data:audio/mp3;base64,${audioClips[0]}`;
      player.onended = () => playNextClip(index);
      await player.play();
    } catch (e: unknown) {
      setVoiceError(e instanceof Error ? e.message : "Voice output failed");
      setPlayingIndex(null);
    } finally {
      setLoadingAudioIndex(null);
    }
  }

  /**
   * Post-turn reflection: hands the exchange to the server-side orchestrator
   * (app/api/coach/reflect), which coordinates the extraction and (every
   * OBS_SUMMARISE_EVERY exchanges) summarisation agents and returns the
   * observation list this client should persist as-is. Replaces the old
   * client-driven extract-then-fire-and-forget-summarise chain — failures
   * are now logged instead of silently swallowed (see CODE_REVIEW.md).
   */
  async function extractAndSave(
    userMessage: string,
    assistantResponse: string,
    currentExchangeCount: number,
    requestPhase: CoachingPhase,
    requestPlanDelivered: boolean
  ) {
    try {
      const res = await fetch("/api/coach/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          assistantResponse,
          exchangeCount: currentExchangeCount,
          existingObservations: observations,
        }),
      });
      if (!res.ok) {
        console.error(`[coach/reflect] request failed with status ${res.status}`);
        return;
      }

      const result = (await res.json()) as {
        finalObservations: CoachingObservation[];
        shouldTransitionToRecommending: boolean;
        degraded: boolean;
        error?: string;
      };

      if (result.degraded) {
        console.error(`[coach/reflect] degraded: ${result.error ?? "unknown failure"}`);
      }

      await storage.clearObservations();
      for (const o of result.finalObservations) await storage.addObservation(o);
      setObservations(result.finalObservations);

      // Update phase + exchange count in profile (localStorage)
      // Hard fallback: force recommending at exchange 3 if extraction hasn't fired.
      // Once a turn has actually run in "recommending" phase, planDelivered flips
      // true — the NEXT turn is a follow-up, not another full plan delivery.
      const newPhase: CoachingPhase =
        requestPhase === "recommending" || result.shouldTransitionToRecommending || currentExchangeCount >= 3
          ? "recommending"
          : "gathering";
      const newPlanDelivered = requestPhase === "recommending" ? true : requestPlanDelivered;
      const current = getProfile();
      saveProfile({
        ...current,
        coaching: {
          ...current.coaching,
          exchangeCount: currentExchangeCount,
          phase: newPhase,
          planDelivered: newPlanDelivered,
          lastUpdated: new Date().toISOString(),
        },
      });

      setPhase(newPhase);
      setPlanDelivered(newPlanDelivered);
      setExchangeCount(currentExchangeCount);
    } catch (e: unknown) {
      console.error(`[coach/reflect] ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // overrideText/forcePlanNow power the "Get my plan now" button — it bypasses
  // the textbox entirely and forces this one turn to be treated as the (still
  // ungrounded-in-nothing-new) plan-delivery turn, skipping remaining discovery.
  async function send(overrideText?: string, forcePlanNow?: boolean) {
    const rawInput = (overrideText ?? input).trim();
    if (!rawInput || streaming) return;
    const isNonEnglish = preferredLanguage !== DEFAULT_LANGUAGE_CODE;

    // Optimistic bubble shows the user's own words immediately; `content`
    // (the canonical English text sent to Claude) is filled in just below.
    const userMsg: ChatMessage = {
      role: "user",
      content: rawInput,
      displayContent: isNonEnglish ? rawInput : undefined,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (overrideText === undefined) setInput("");
    setStreaming(true);

    // Phase/planDelivered actually used for THIS request — read explicitly
    // rather than from the `phase`/`planDelivered` state closures, since a
    // forced call can happen in the same tick as the state update that set
    // them, before this component has re-rendered with the new values.
    const requestPhase: CoachingPhase = forcePlanNow ? "recommending" : phase;
    const requestPlanDelivered = forcePlanNow ? false : planDelivered;

    if (isNonEnglish) {
      try {
        userMsg.content = await translateViaApi(rawInput, preferredLanguage, DEFAULT_LANGUAGE_CODE);
      } catch {
        // Claude often understands common Indian languages directly — degrade gracefully
      }
    }

    const newMessages = [...messages, userMsg];
    addChatMessage(userMsg);
    const capturedInput = userMsg.content;

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
          phase: requestPhase,
          planDelivered: requestPlanDelivered,
          includeReligiousSolutions,
          tonePreference,
          transitContext: transitContext || undefined,
          messages: (() => {
            // Keep up to 20 messages, but the Anthropic API requires the first
            // message to be a user turn. A slice of an odd-length array can
            // start with an assistant message, which causes API errors.
            const window = newMessages.slice(-20).map((m) => ({ role: m.role, content: m.content }));
            const firstUser = window.findIndex((m) => m.role === "user");
            return firstUser > 0 ? window.slice(firstUser) : window;
          })(),
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

      if (isNonEnglish) {
        try {
          finalMsg.displayContent = await translateViaApi(accumulated, DEFAULT_LANGUAGE_CODE, preferredLanguage);
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...copy[copy.length - 1], displayContent: finalMsg.displayContent };
            return copy;
          });
        } catch {
          // Display falls back to the English reply — non-fatal
        }
      }

      addChatMessage(finalMsg);

      // TOKEN-05: skip extraction for short exchanges — not enough signal
      // But still count the exchange and apply the hard phase cap
      const nextExchangeCount = exchangeCount + 1;
      if (capturedInput.length >= EXTRACT_MIN_USER_CHARS && accumulated.length >= EXTRACT_MIN_ASST_CHARS) {
        extractAndSave(capturedInput, accumulated, nextExchangeCount, requestPhase, requestPlanDelivered);
      } else {
        // Short exchange — update count and check hard cap without calling Claude
        const newPhase: CoachingPhase =
          requestPhase === "recommending" || nextExchangeCount >= 3 ? "recommending" : "gathering";
        const newPlanDelivered = requestPhase === "recommending" ? true : requestPlanDelivered;
        const current = getProfile();
        saveProfile({
          ...current,
          coaching: {
            ...current.coaching,
            exchangeCount: nextExchangeCount,
            phase: newPhase,
            planDelivered: newPlanDelivered,
            lastUpdated: new Date().toISOString(),
          },
        });
        setPhase(newPhase);
        setPlanDelivered(newPlanDelivered);
        setExchangeCount(nextExchangeCount);
      }
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
      setTimeout(() => inputRef.current?.focus(), 50);
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
        <span className="ml-auto flex items-center gap-2 text-gray-500">
          {/* New Topic */}
          <button
            type="button"
            onClick={startNewTopic}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-gray-50 text-gray-500 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
            title="Clear conversation and start a new topic (keeps your chart and profile)"
          >
            <RotateCcw className="w-3 h-3" /> New Topic
          </button>
          {/* Skip discovery, get the plan immediately */}
          {phase === "gathering" && (
            <button
              type="button"
              onClick={() => send("Please give me my complete plan now, based on everything so far.", true)}
              disabled={streaming}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-40"
              title="Skip ahead — get your complete plan now instead of continuing discovery"
            >
              <Zap className="w-3 h-3" /> Get My Plan Now
            </button>
          )}
          {/* Vedic remedies toggle */}
          <button
            onClick={toggleReligiousSolutions}
            className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
              includeReligiousSolutions
                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
            title={
              includeReligiousSolutions
                ? "Vedic remedies (mantra, gemstone, dana) included alongside behavioral practice — click for behavioral-only"
                : "Behavioral-only mode — click to include traditional Vedic remedies"
            }
          >
            {includeReligiousSolutions ? "🕉 Vedic Remedies" : "⚛ Behavioral Only"}
          </button>
          {/* Voice/framing toggle — see SPEC.md §3 */}
          <button
            onClick={toggleTonePreference}
            className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
              tonePreference === "skeptic"
                ? "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
            title={
              tonePreference === "skeptic"
                ? "Plain-language mode — same chart and analysis, no mystical framing. Click for traditional Jyotish voice"
                : "Traditional Jyotish voice — click for plain psychological/behavioral language instead"
            }
          >
            {tonePreference === "skeptic" ? "🎯 Plain Language" : "🕉 Traditional Voice"}
          </button>
          {/* Language selector */}
          <select
            value={preferredLanguage}
            onChange={(e) => changeLanguage(e.target.value)}
            title="Coaching language — your messages and the coach's replies are translated"
            className="text-xs px-2 py-0.5 rounded-full font-medium border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 focus:outline-none"
          >
            {SARVAM_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {observations.length > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                phase === "recommending"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
              title={
                planDelivered
                  ? "Plan delivered — ask follow-ups anytime, or start a New Topic"
                  : phase === "recommending"
                  ? `${observations.length} observations gathered — giving recommendations`
                  : `${observations.length} observations gathered — still learning`
              }
            >
              {planDelivered ? (
                <><CheckCircle2 className="w-3 h-3" /> Plan delivered</>
              ) : phase === "recommending" ? (
                <><PlayCircle className="w-3 h-3" /> Recommending</>
              ) : (
                <><CircleDot className="w-3 h-3" /> Gathering ({observations.length})</>
              )}
            </span>
          )}
          <span>Lagna: {SIGN_NAMES[chart.ascendant.sign_num]}</span>
          <Link href="/trust" className="hover:text-gray-600 underline decoration-dotted underline-offset-2" title="How we calculate your chart, and why we never upsell remedies">
            How we work
          </Link>
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="w-9 h-9 mb-3 mx-auto text-indigo-300" />
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
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
              }`}
            >
              {msg.role === "assistant" && msg.content === "" ? (
                <span className="inline-flex items-center gap-1.5 text-gray-500">
                  <svg className="w-3 h-3 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-xs">Thinking…</span>
                </span>
              ) : msg.role === "assistant" ? (
                <>
                  <div className="chat-markdown text-base leading-relaxed">
                    <ReactMarkdown>{msg.displayContent ?? msg.content}</ReactMarkdown>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleListen(i, msg.displayContent ?? msg.content)}
                    disabled={loadingAudioIndex === i}
                    className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50 inline-flex items-center gap-1"
                    title="Hear this reply spoken aloud"
                  >
                    {loadingAudioIndex === i ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Loading…</>
                    ) : playingIndex === i ? (
                      <><Pause className="w-3 h-3" /> Stop</>
                    ) : (
                      <><Volume2 className="w-3 h-3" /> Listen</>
                    )}
                  </button>
                </>
              ) : (
                <p className="whitespace-pre-wrap">{msg.displayContent ?? msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleRecording}
            disabled={streaming || transcribing}
            title={recording ? "Stop recording" : "Speak your message"}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium border transition-colors disabled:opacity-50 ${
              recording
                ? "bg-red-50 border-red-200 text-red-600 animate-pulse"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={phase === "recommending" ? "Ask for recommendations..." : "Tell me about yourself..."}
            disabled={streaming}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
          >
            {streaming ? "..." : "Send"}
          </button>
        </div>
        {voiceError && (
          <p className="text-xs text-red-500 text-center mt-1.5">{voiceError}</p>
        )}
        <p className="text-[10px] text-gray-500 text-center mt-2">
          Jyotish guidance for reflection and remedial practice — not a substitute for professional medical, mental health, legal, or financial advice.
        </p>
      </div>
    </div>
  );
}
