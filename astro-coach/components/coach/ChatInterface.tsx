"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Sparkles, RotateCcw, Zap, CheckCircle2, PlayCircle, CircleDot, Loader2, Pause, Volume2, Mic, Square, RefreshCw, AlertCircle, Brain, X, ThumbsUp, ThumbsDown, Settings2 } from "lucide-react";
import type { ChatMessage, NatalChart, DashaData, CoachingObservation, CoachingPhase, CoachTonePreference, CachedTransits, PastCoachingTopic, Habit } from "@/lib/profile";
import { addChatMessage, buildCoachingContext, getProfile, saveProfile, updateProfile } from "@/lib/profile";
import type { GeneratedHabit } from "@/lib/habit-schema";
import { storage } from "@/lib/storage-supabase";
import { PLANET_META, SIGN_NAMES, type PlanetKey } from "@/lib/astrology/planets";
import { DEFAULT_LANGUAGE_CODE, SARVAM_LANGUAGES } from "@/lib/languages";
import CoachPreferences, { saveCoachPreferences, type CoachPreferenceValues } from "@/components/settings/CoachPreferences";
import { createCoachStreamParser, type CoachTurnOutcome } from "@/lib/coach-stream";
import AdviceDisclaimer from "@/components/AdviceDisclaimer";
import SupportNudge from "@/components/support/SupportNudge";
import { CRISIS_RESPONSE } from "@/lib/coach-safety";
import { FEEDBACK_REASONS, type FeedbackRating } from "@/lib/coach-feedback";
import {
  CHAT_HISTORY_DISPLAY,
  CHAT_WINDOW_API,
  EXTRACT_MIN_USER_CHARS,
  EXTRACT_MIN_ASST_CHARS,
  MAX_PAST_TOPICS,
  TRANSIT_TTL_MS,
} from "@/lib/constants";

const MAX_RECORDING_MS = 2 * 60 * 1000;

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
    profile.coaching.includeReligiousSolutions ?? false
  );
  const [tonePreference, setTonePreference] = useState<CoachTonePreference>(
    profile.coaching.tonePreference ?? "jyotish"
  );
  const [preferredLanguage, setPreferredLanguage] = useState(
    profile.coaching.preferredLanguage ?? DEFAULT_LANGUAGE_CODE
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState("");
  const [confirmingNewTopic, setConfirmingNewTopic] = useState(false);
  const [pastTopics, setPastTopics] = useState<PastCoachingTopic[]>(profile.coaching.pastTopics ?? []);
  const [planHabits, setPlanHabits] = useState<GeneratedHabit[] | null>(null);
  const [planHabitsLoading, setPlanHabitsLoading] = useState(false);
  const [planHabitsError, setPlanHabitsError] = useState("");
  const [addedHabits, setAddedHabits] = useState<string[]>([]);
  const [supportNudgeDismissed, setSupportNudgeDismissed] = useState(profile.coaching.supportNudgeDismissed ?? false);
  const [showMemory, setShowMemory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reasonPickerFor, setReasonPickerFor] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<{ ts: string; text: string } | null>(null);
  const [memoryStatus, setMemoryStatus] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [loadingAudioIndex, setLoadingAudioIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Latest observations, readable from async callbacks without a stale closure.
  const observationsRef = useRef<CoachingObservation[]>([]);
  // The in-flight post-turn reflection. The next turn waits for it so it is
  // sent with the phase and observations that reflection decided on.
  const reflectionRef = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRequestRef = useRef<{ text: string; forcePlanNow: boolean } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);

  function updatePreferences(change: Partial<CoachPreferenceValues>) {
    if (change.includeReligiousSolutions !== undefined) setIncludeReligiousSolutions(change.includeReligiousSolutions);
    if (change.tonePreference !== undefined) setTonePreference(change.tonePreference);
    if (change.preferredLanguage !== undefined) setPreferredLanguage(change.preferredLanguage);
    saveCoachPreferences(change);
  }

  function setObservationList(list: CoachingObservation[]) {
    observationsRef.current = list;
    setObservations(list);
  }

  // Load observations from IndexedDB on mount
  useEffect(() => {
    storage.getObservations().then(setObservationList);
  }, []);

  // Keep the cached transits fresh for the home-page daily note. The coach
  // itself no longer uses this copy: /api/coach computes transits server-side.
  useEffect(() => {
    async function loadTransits() {
      const p = getProfile();
      const cached = p.cachedTransits;
      const natalMoonSign = chart.planets.moon?.sign_num ?? 0;
      const tzStr = p.birthData?.timezone ?? "UTC";

      if (cached && cached.tzStr === tzStr && Date.now() - new Date(cached.cachedAt).getTime() < TRANSIT_TTL_MS) {
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
      } catch {
        // Non-critical — only feeds the home-page note
      }
    }
    loadTransits();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function startNewTopic() {
    // Reset conversation state — keep chart, profile, and observations (accumulated
    // context). A delivered plan is archived first so it isn't lost with the chat.
    setConfirmingNewTopic(false);
    setChatError("");
    setPlanHabits(null);
    setPlanHabitsError("");
    setSupportNudgeDismissed(false);
    const current = getProfile();
    const plan = current.coaching.deliveredPlan?.trim();
    const firstQuestion = current.chatHistory.find((m) => m.role === "user");
    const archived: PastCoachingTopic[] = plan
      ? [
          {
            id: crypto.randomUUID(),
            endedAt: new Date().toISOString(),
            title: (firstQuestion?.displayContent ?? firstQuestion?.content ?? "Earlier topic").slice(0, 120),
            plan,
          },
          ...(current.coaching.pastTopics ?? []),
        ].slice(0, MAX_PAST_TOPICS)
      : (current.coaching.pastTopics ?? []);

    setMessages([]);
    setPhase("gathering");
    setExchangeCount(0);
    setPlanDelivered(false);
    setPastTopics(archived);
    saveProfile({
      ...current,
      chatHistory: [],
      coaching: {
        ...current.coaching,
        phase: "gathering",
        exchangeCount: 0,
        planDelivered: false,
        deliveredPlan: undefined,
        pastTopics: archived,
        supportNudgeDismissed: false,
        lastUpdated: new Date().toISOString(),
      },
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function proposePlanHabits() {
    const plan = getProfile().coaching.deliveredPlan;
    if (!plan || planHabitsLoading) return;
    setPlanHabitsLoading(true);
    setPlanHabitsError("");
    try {
      const res = await fetch("/api/coach/plan-habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't turn the plan into habits.");
      const habits = (data.habits ?? []) as GeneratedHabit[];
      if (habits.length === 0) throw new Error("This plan has no repeatable practices to track.");
      setPlanHabits(habits);
      setAddedHabits([]);
    } catch (e: unknown) {
      setPlanHabitsError(e instanceof Error ? e.message : "Couldn't turn the plan into habits.");
    } finally {
      setPlanHabitsLoading(false);
    }
  }

  function addPlanHabit(h: GeneratedHabit) {
    const current = getProfile();
    const exists = current.habits.some((x) => x.habit.trim().toLowerCase() === h.habit.trim().toLowerCase());
    if (!exists) {
      const habit: Habit = { ...h, id: crypto.randomUUID(), completedDates: [], streak: 0 };
      updateProfile({ habits: [...current.habits, habit] });
    }
    setAddedHabits((prev) => [...prev, h.habit]);
  }

  /** Let the user remove what the coach has noted about them. Deletions are
   * pushed to their account straight away; if that fails, we say so. */
  async function forgetObservations(ids: string[] | "all") {
    if (reflectionRef.current) await reflectionRef.current;
    const remaining = ids === "all" ? [] : observationsRef.current.filter((o) => !ids.includes(o.id));
    await storage.clearObservations();
    for (const o of remaining) await storage.addObservation(o);
    setObservationList(remaining);
    try {
      await storage.syncToServer("");
      setMemoryStatus("Removed from this device and your account.");
    } catch {
      setMemoryStatus("Removed from this device. Your account copy updates on the next successful sync.");
    }
  }

  function dismissSupportNudge() {
    setSupportNudgeDismissed(true);
    const current = getProfile();
    saveProfile({ ...current, coaching: { ...current.coaching, supportNudgeDismissed: true } });
  }

  /** Thumbs up/down on a reply. Clicking the active thumb again clears it. */
  async function rateMessage(msg: ChatMessage, rating: FeedbackRating | null, reason?: string) {
    const apply = (m: ChatMessage): ChatMessage =>
      m.role === "assistant" && m.timestamp === msg.timestamp
        ? { ...m, feedback: rating ?? undefined, feedbackReason: rating === "down" ? reason : undefined }
        : m;
    setMessages((prev) => prev.map(apply));
    const current = getProfile();
    saveProfile({ ...current, chatHistory: current.chatHistory.map(apply) });
    setReasonPickerFor(rating === "down" && !reason ? msg.timestamp : null);
    try {
      const res = await fetch("/api/coach/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageTimestamp: msg.timestamp,
          rating,
          reason: rating === "down" ? reason : undefined,
          reply: msg.content,
          phase,
          tone: tonePreference,
        }),
      });
      if (!res.ok) throw new Error();
      setFeedbackNote(rating ? { ts: msg.timestamp, text: rating === "up" ? "Thanks — noted." : reason ? "Thanks — that helps." : "What was off?" } : null);
    } catch {
      setFeedbackNote({ ts: msg.timestamp, text: "Saved on this device; couldn't reach the server." });
    }
  }

  function requestNewTopic() {
    if (messages.length === 0) {
      startNewTopic();
      return;
    }
    setConfirmingNewTopic(true);
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
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
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
      // Cap the clip so a forgotten mic doesn't record (and upload) indefinitely.
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);
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

  /** Record a completed turn: exchange count, phase, and whether the plan is out. */
  function commitTurn(
    count: number,
    requestPhase: CoachingPhase,
    requestPlanDelivered: boolean,
    shouldTransition: boolean
  ) {
    // Hard fallback: force recommending at exchange 3 if extraction hasn't fired.
    // Once a turn has actually run in "recommending" phase, planDelivered flips
    // true — the NEXT turn is a follow-up, not another full plan delivery.
    const newPhase: CoachingPhase =
      requestPhase === "recommending" || shouldTransition || count >= 3 ? "recommending" : "gathering";
    const newPlanDelivered = requestPhase === "recommending" ? true : requestPlanDelivered;
    const current = getProfile();
    saveProfile({
      ...current,
      coaching: {
        ...current.coaching,
        exchangeCount: count,
        phase: newPhase,
        planDelivered: newPlanDelivered,
        lastUpdated: new Date().toISOString(),
      },
    });
    setPhase(newPhase);
    setPlanDelivered(newPlanDelivered);
    setExchangeCount(count);
  }

  /**
   * Post-turn reflection: hands the exchange to the server-side orchestrator
   * (app/api/coach/reflect), which coordinates the extraction and (once
   * OBS_SUMMARISE_AT observations have built up) summarisation agents and
   * returns the observation list this client should persist as-is. The turn
   * is always counted, even when reflection fails, so the phase cap still holds.
   */
  async function reflectAndCommit(
    userMessage: string,
    assistantResponse: string,
    count: number,
    requestPhase: CoachingPhase,
    requestPlanDelivered: boolean
  ) {
    let shouldTransition = false;
    try {
      const res = await fetch("/api/coach/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          assistantResponse,
          exchangeCount: count,
          existingObservations: observationsRef.current,
        }),
      });
      if (!res.ok) {
        console.error(`[coach/reflect] request failed with status ${res.status}`);
      } else {
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
        setObservationList(result.finalObservations);
        shouldTransition = result.shouldTransitionToRecommending;
      }
    } catch (e: unknown) {
      console.error(`[coach/reflect] ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      commitTurn(count, requestPhase, requestPlanDelivered, shouldTransition);
    }
  }

  function friendlyCoachError(status: number, serverMessage?: string): string {
    if (status === 429) return serverMessage?.includes("today") ? serverMessage : "You're sending messages quickly. Wait a moment, then try again.";
    if (status === 401) return "Your session has expired. Please sign in again to continue.";
    return serverMessage || "The coach couldn't respond just now. Please try again.";
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  // forcePlanNow powers the "Get my plan now" button — it bypasses the textbox
  // entirely and forces this one turn to be treated as the plan-delivery turn,
  // skipping remaining discovery. `retry` re-sends the last user message after a
  // failed turn without adding it to the conversation a second time.
  async function send(overrideText?: string, forcePlanNow?: boolean, retry = false) {
    const rawInput = (overrideText ?? input).trim();
    if (!rawInput || streaming) return;
    const isNonEnglish = preferredLanguage !== DEFAULT_LANGUAGE_CODE;
    setChatError("");
    setStreaming(true);
    lastRequestRef.current = { text: rawInput, forcePlanNow: !!forcePlanNow };

    let baseMessages = messages;
    if (!retry) {
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
      if (isNonEnglish) {
        try {
          userMsg.content = await translateViaApi(rawInput, preferredLanguage, DEFAULT_LANGUAGE_CODE);
        } catch {
          // Claude often understands common Indian languages directly — degrade gracefully
        }
      }
      addChatMessage(userMsg);
      baseMessages = [...messages, userMsg];
    }
    const lastUser = [...baseMessages].reverse().find((m) => m.role === "user");
    const capturedInput = lastUser?.content ?? rawInput;

    // Let the previous turn's reflection land first, so this request carries
    // the phase and observations it decided on rather than stale ones.
    if (reflectionRef.current) await reflectionRef.current;

    const currentProfile = getProfile();
    const requestPhase: CoachingPhase = forcePlanNow ? "recommending" : (currentProfile.coaching.phase ?? "gathering");
    const requestPlanDelivered = forcePlanNow ? false : (currentProfile.coaching.planDelivered ?? false);
    const isPlanTurn = requestPhase === "recommending" && !requestPlanDelivered;

    setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: new Date().toISOString() }]);
    const showAssistant = (text: string) =>
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: text };
        return copy;
      });
    const dropAssistant = () => setMessages((prev) => prev.slice(0, -1));

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";
    let outcome: CoachTurnOutcome | null = null;

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          birthData: currentProfile.birthData,
          goals: currentProfile.goals.map((g) => g.description),
          habits: currentProfile.habits,
          // Observations injected here — survive regardless of message window truncation
          profileContext: buildCoachingContext(currentProfile, observationsRef.current),
          deliveredPlan: requestPlanDelivered ? currentProfile.coaching.deliveredPlan : undefined,
          phase: requestPhase,
          planDelivered: requestPlanDelivered,
          includeReligiousSolutions,
          tonePreference,
          messages: (() => {
            const window = baseMessages
              .filter((m) => m.content.trim())
              .slice(-CHAT_WINDOW_API)
              .map((m) => ({ role: m.role, content: m.content }));
            const firstUser = window.findIndex((m) => m.role === "user");
            return firstUser > 0 ? window.slice(firstUser) : window;
          })(),
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(friendlyCoachError(res.status, typeof body.error === "string" ? body.error : undefined));
      }

      const parser = createCoachStreamParser();
      let serverError = "";
      const apply = (events: ReturnType<typeof parser.push>) => {
        let changed = false;
        for (const event of events) {
          if (event.type === "text") { accumulated += event.text; changed = true; }
          else if (event.type === "replace") { accumulated = event.text; changed = true; }
          else if (event.type === "error") serverError = event.error;
          else outcome = event.outcome;
        }
        if (changed) showAssistant(accumulated);
      };

      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        apply(parser.push(value));
      }
      apply(parser.end());

      if (serverError) throw new Error(serverError);
      if (!accumulated.trim()) throw new Error("The coach didn't send a reply. Please try again.");

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

      // Only a normal, grounded reply moves the conversation forward. A safety
      // reply or a guard fallback is shown but is not "the plan", and an
      // interrupted stream (no done event) doesn't count either.
      if (outcome !== "ok") return;

      if (isPlanTurn) {
        const current = getProfile();
        saveProfile({ ...current, coaching: { ...current.coaching, deliveredPlan: accumulated } });
      }

      const nextExchangeCount = (currentProfile.coaching.exchangeCount ?? exchangeCount) + 1;
      // TOKEN-05: skip extraction for short exchanges — not enough signal
      if (capturedInput.length >= EXTRACT_MIN_USER_CHARS && accumulated.length >= EXTRACT_MIN_ASST_CHARS) {
        const pending = reflectAndCommit(capturedInput, accumulated, nextExchangeCount, requestPhase, requestPlanDelivered);
        reflectionRef.current = pending.finally(() => {
          if (reflectionRef.current === pending) reflectionRef.current = null;
        });
      } else {
        commitTurn(nextExchangeCount, requestPhase, requestPlanDelivered, false);
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) {
        // Stopped by the user: keep whatever was written, but it doesn't count as a turn.
        if (accumulated.trim()) {
          addChatMessage({ role: "assistant", content: accumulated, timestamp: new Date().toISOString() });
        } else {
          dropAssistant();
        }
      } else {
        dropAssistant();
        setChatError(e instanceof Error && e.message ? e.message : "The coach couldn't respond just now. Please try again.");
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function retryLast() {
    const last = lastRequestRef.current;
    if (!last) return;
    send(last.text, last.forcePlanNow, true);
  }

  const suggestions = [
    `What does my ${dashas.current_antar} Antardasha mean for my work right now?`,
    chart.doshas?.[0]
      ? `How do I work with my ${chart.doshas[0].name}?`
      : `What should I practise during my ${dashas.current_maha} Mahadasha?`,
    "Where am I strongest, and how do I use it?",
  ];

  const currentMahaMeta = PLANET_META[dashas.current_maha.toLowerCase() as PlanetKey];

  return (
    <div className="flex flex-col h-full">
      {/* Context bar. The chat column is max-w-3xl, which is too narrow for
          every control on one line — a shrinking rounded-full button collapses
          into a circle and clips "Lagna" / "How we work". */}
      <div className="flex flex-col gap-2 p-3 border-b border-gray-100 bg-gray-50 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="text-xl shrink-0">{currentMahaMeta?.symbol ?? "●"}</span>
          <span className="text-gray-600 min-w-0">
            <span className="font-medium text-gray-900">{dashas.current_maha}</span> Maha ·{" "}
            <span className="font-medium text-gray-900">{dashas.current_antar}</span> Antar
          </span>
          <span className="ml-auto shrink-0 whitespace-nowrap text-xs text-gray-500">
            Lagna: {SIGN_NAMES[chart.ascendant.sign_num]}
          </span>
          <Link href="/trust" className="shrink-0 whitespace-nowrap text-xs text-gray-500 hover:text-gray-600 underline decoration-dotted underline-offset-2" title="How we calculate your chart, and why we never upsell remedies">
            How we work
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-gray-500">
          {/* New Topic */}
          <button
            type="button"
            onClick={requestNewTopic}
            disabled={streaming}
            className="disabled:opacity-40 inline-flex shrink-0 whitespace-nowrap items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-gray-50 text-gray-500 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
            title="Start a new topic (your chart and profile stay; a delivered plan is saved under Earlier plans)"
          >
            <RotateCcw className="w-3 h-3" /> New Topic
          </button>
          {/* Skip discovery, get the plan immediately */}
          {planDelivered && (
            <button
              type="button"
              onClick={proposePlanHabits}
              disabled={planHabitsLoading || streaming}
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              title="Turn this plan's behavioral practices into tracked sadhana"
            >
              {planHabitsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Track this plan
            </button>
          )}
          {phase === "gathering" && (
            <button
              type="button"
              onClick={() => send("Please give me my complete plan now, based on everything so far.", true)}
              disabled={streaming}
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-40"
              title="Skip ahead — get your complete plan now instead of continuing discovery"
            >
              <Zap className="w-3 h-3" /> Get My Plan Now
            </button>
          )}
          {/* Remedy mode, voice and language live in one settings panel (also on /profile). */}
          <button
            type="button"
            onClick={() => { setShowSettings((v) => !v); setShowMemory(false); }}
            aria-expanded={showSettings}
            className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            title="Remedies, voice and language"
          >
            <Settings2 className="w-3 h-3" /> Settings
          </button>
          <button
            type="button"
            onClick={() => { setShowMemory((v) => !v); setShowSettings(false); setMemoryStatus(""); }}
            className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            title="See and delete what the coach has noted about you"
          >
            <Brain className="w-3 h-3" /> Memory ({observations.length})
          </button>
          {observations.length > 0 && (
            <span
              className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
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
        </div>
      </div>

      {showSettings && (
        <div className="px-4 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coach settings</p>
            <button type="button" onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close settings">
              <X className="w-4 h-4" />
            </button>
          </div>
          <CoachPreferences
            value={{ includeReligiousSolutions, tonePreference, preferredLanguage }}
            onChange={updatePreferences}
          />
          <p className="mt-3 text-[11px] text-gray-500">
            Current: {includeReligiousSolutions ? "Vedic remedies on" : "Behavioral only"} · {tonePreference === "skeptic" ? "Plain language" : "Traditional voice"} · {SARVAM_LANGUAGES.find((l) => l.code === preferredLanguage)?.label ?? preferredLanguage}. Also on your Profile page.
          </p>
        </div>
      )}

      {showMemory && (
        <div className="px-4 py-3 border-b border-gray-100 bg-white text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">What the coach remembers about you</p>
            <button type="button" onClick={() => setShowMemory(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close memory">
              <X className="w-4 h-4" />
            </button>
          </div>
          {observations.length === 0 ? (
            <p className="text-xs text-gray-500">Nothing yet. Notes appear here as you share things in conversation.</p>
          ) : (
            <>
              <ul className="max-h-48 overflow-y-auto space-y-1">
                {observations.map((o) => (
                  <li key={o.id} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">{o.category}</span>
                    <span className="flex-1 min-w-0">{o.text}</span>
                    <button
                      type="button"
                      onClick={() => forgetObservations([o.id])}
                      disabled={streaming}
                      className="shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-40"
                      aria-label="Forget this note"
                      title="Forget this note"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => forgetObservations("all")}
                disabled={streaming}
                className="mt-2 text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
              >
                Forget all
              </button>
            </>
          )}
          {memoryStatus && <p className="mt-1 text-xs text-gray-500">{memoryStatus}</p>}
        </div>
      )}

      {confirmingNewTopic && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-amber-100 bg-amber-50 text-xs text-amber-800">
          <span className="flex-1 min-w-0">
            Start a new topic? This conversation will be cleared{planDelivered ? "; its plan is saved under Earlier plans" : ""}.
          </span>
          <button type="button" onClick={startNewTopic} className="px-2.5 py-1 rounded-full bg-amber-600 text-white font-medium hover:bg-amber-700">
            Start new topic
          </button>
          <button type="button" onClick={() => setConfirmingNewTopic(false)} className="px-2.5 py-1 rounded-full border border-amber-200 font-medium hover:bg-amber-100">
            Cancel
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="w-9 h-9 mb-3 mx-auto text-indigo-300" />
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Your personal Vedic astrology coach is ready. Ask anything about your chart, current period, goals, or life direction.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                >
                  {s}
                </button>
              ))}
            </div>
            {pastTopics.length > 0 && (
              <div className="mt-8 max-w-xl mx-auto text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Earlier plans</p>
                <div className="space-y-2">
                  {pastTopics.map((t) => (
                    <details key={t.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <summary className="cursor-pointer text-sm text-gray-700">
                        {t.title}
                        <span className="ml-2 text-xs text-gray-500">{new Date(t.endedAt).toLocaleDateString()}</span>
                      </summary>
                      <div className="chat-markdown mt-2 text-sm leading-relaxed text-gray-800">
                        <ReactMarkdown>{t.plan}</ReactMarkdown>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
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
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleListen(i, msg.displayContent ?? msg.content)}
                      disabled={loadingAudioIndex === i}
                      className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50 inline-flex items-center gap-1"
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
                    {/* Ratings are for coaching replies; the crisis reply isn't one. */}
                    {msg.content !== CRISIS_RESPONSE && !(streaming && i === messages.length - 1) && (
                      <span className="inline-flex items-center gap-1" title="Rating saves your thumbs and this reply (not your messages) to your account, to improve the coach">
                        <button
                          type="button"
                          onClick={() => rateMessage(msg, msg.feedback === "up" ? null : "up")}
                          aria-label="Helpful"
                          aria-pressed={msg.feedback === "up"}
                          className={`p-1 rounded-md transition-colors ${msg.feedback === "up" ? "text-emerald-600 bg-emerald-50" : "text-gray-400 hover:text-gray-600"}`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => rateMessage(msg, msg.feedback === "down" ? null : "down")}
                          aria-label="Not helpful"
                          aria-pressed={msg.feedback === "down"}
                          className={`p-1 rounded-md transition-colors ${msg.feedback === "down" ? "text-rose-600 bg-rose-50" : "text-gray-400 hover:text-gray-600"}`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    )}
                    {feedbackNote?.ts === msg.timestamp && (
                      <span className="text-[11px] text-gray-500">{feedbackNote.text}</span>
                    )}
                  </div>
                  {reasonPickerFor === msg.timestamp && msg.feedback === "down" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {FEEDBACK_REASONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => rateMessage(msg, "down", r.id)}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="whitespace-pre-wrap">{msg.displayContent ?? msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {planDelivered && !streaming && !supportNudgeDismissed &&
          // Never under a crisis reply: that moment is about getting help, not us.
          messages[messages.length - 1]?.content !== CRISIS_RESPONSE && (
          <SupportNudge
            message="Found this useful? Astro Coach has no paywall. If you'd like to help keep it running,"
            onDismiss={dismissSupportNudge}
          />
        )}
        {(planHabits || planHabitsError) && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Practices from this plan</p>
              <button type="button" onClick={() => { setPlanHabits(null); setPlanHabitsError(""); }} className="text-xs text-emerald-700 hover:underline">
                Close
              </button>
            </div>
            {planHabitsError && <p className="text-sm text-red-600">{planHabitsError}</p>}
            {planHabits && (
              <ul className="space-y-2">
                {planHabits.map((h) => {
                  const added = addedHabits.includes(h.habit);
                  return (
                    <li key={h.habit} className="flex items-start gap-3 rounded-xl bg-white border border-emerald-100 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{h.habit}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {h.frequency} · {PLANET_META[h.planet as PlanetKey]?.label ?? h.planet}{h.why ? ` · ${h.why}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addPlanHabit(h)}
                        disabled={added}
                        className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:bg-emerald-600 disabled:text-white disabled:border-emerald-600"
                      >
                        {added ? "Added" : "Add"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {addedHabits.length > 0 && (
              <Link href="/habits" className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline">
                Open Sadhana tracker →
              </Link>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        {chatError && (
          <div role="alert" className="mb-2 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 min-w-0">{chatError}</span>
            <button
              type="button"
              onClick={retryLast}
              disabled={streaming}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-white px-2 py-0.5 font-medium hover:bg-red-100 disabled:opacity-40"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
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
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={phase === "recommending" ? "Ask a follow-up… (Shift+Enter for a new line)" : "Tell me what's going on… (Shift+Enter for a new line)"}
            disabled={streaming}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              title="Stop generating"
              className="inline-flex items-center gap-1 border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          ) : (
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
            >
              Send
            </button>
          )}
        </div>
        {voiceError && (
          <p className="text-xs text-red-500 text-center mt-1.5">{voiceError}</p>
        )}
        <AdviceDisclaimer className="mt-2" />
      </div>
    </div>
  );
}
