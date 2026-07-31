"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import { BookOpen, RotateCw, Copy, CheckCheck, Loader2 } from "lucide-react";
import NavBar from "@/components/NavBar";
import SignInRequired from "@/components/SignInRequired";
import { getProfile, updateProfile, type UserProfile } from "@/lib/profile";

export default function FoundationPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [streamedContent, setStreamedContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = getProfile();
    if (!p.chart || !p.dashas) { router.push("/"); return; }
    queueMicrotask(() => setProfile(p));
  }, [router]);

  async function generate() {
    if (!profile?.chart || !profile?.dashas) return;
    setGenerating(true);
    setError("");
    setStreamedContent("");
    try {
      const res = await fetch("/api/foundation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart: profile.chart,
          dashas: profile.dashas,
          includeReligiousSolutions: profile.coaching.includeReligiousSolutions,
          tonePreference: profile.coaching.tonePreference,
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
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              accumulated += parsed.text;
              setStreamedContent(accumulated);
            }
          } catch {
            // Ignore partial/non-JSON SSE fragments; real errors below.
          }
        }
      }

      if (!accumulated.trim()) throw new Error("No content generated — try again");

      const current = getProfile();
      updateProfile({
        foundation: {
          content: accumulated,
          generatedAt: new Date().toISOString(),
          tonePreference: current.coaching.tonePreference,
        },
      });
      setProfile(getProfile());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate your Foundation");
    } finally {
      setGenerating(false);
    }
  }

  async function copyToClipboard() {
    const text = profile?.foundation?.content ?? streamedContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — non-fatal, just don't show the "copied" state
    }
  }

  if (!profile?.chart || status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white">
        <NavBar />
        <SignInRequired feature="Your Foundation" />
      </div>
    );
  }

  const saved = profile.foundation;
  const displayContent = generating ? streamedContent : saved?.content ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white">
      <NavBar />

      <div className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" /> Your Foundation
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              A single, considered read — grounded in your chart, written once, worth returning to.
            </p>
          </div>
          {saved && !generating && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={generate}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" /> Regenerate
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {!saved && !generating && (
          <div className="border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <BookOpen className="w-9 h-9 mb-3 mx-auto text-indigo-300" />
            <p className="text-gray-500 text-sm mb-4 max-w-sm mx-auto">
              A complete, standalone read of your chart — core nature, inner world, what this
              period is asking of you, your natural strengths, and where the real friction lives.
              Generated once from your chart; read it whenever you want.
            </p>
            <button
              onClick={generate}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
            >
              Generate My Foundation →
            </button>
          </div>
        )}

        {generating && !displayContent && (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 mb-3 mx-auto text-indigo-300 animate-spin" />
            <p className="text-gray-500 text-sm">Reading your chart…</p>
          </div>
        )}

        {displayContent && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="chat-markdown text-[15px] leading-relaxed text-gray-800">
              <ReactMarkdown>{displayContent}</ReactMarkdown>
            </div>
            {generating && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-3">
                <Loader2 className="w-3 h-3 animate-spin" /> Writing…
              </span>
            )}
          </div>
        )}

        {saved && !generating && (
          <p className="text-center text-xs text-gray-500 mt-4">
            Generated {new Date(saved.generatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        )}
      </div>
    </div>
  );
}
