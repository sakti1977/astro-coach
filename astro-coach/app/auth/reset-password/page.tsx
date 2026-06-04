"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingLink, setCheckingLink] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const code = useMemo(() => searchParams.get("code"), [searchParams]);

  useEffect(() => {
    let isMounted = true;

    async function initRecoverySession() {
      setCheckingLink(true);
      setError("");

      if (!supabase) {
        if (isMounted) {
          setError("Password reset is not configured. Please contact support.");
          setCheckingLink(false);
        }
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && isMounted) {
          setError(exchangeError.message);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setHasRecoverySession(Boolean(data.session));
        setCheckingLink(false);
      }
    }

    initRecoverySession();

    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasRecoverySession(true);
        setCheckingLink(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [code]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!supabase) {
      setError("Password reset is not configured. Please contact support.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess(true);
      await supabase.auth.signOut();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingLink) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-3xl mb-4">✦</div>
          <p className="text-gray-500">Verifying reset link...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl shadow-gray-100/80 border border-gray-100">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <span className="text-white text-lg">✦</span>
            </div>
            <span className="font-bold text-gray-900 text-xl tracking-tight">Astro Coach</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a new password for your account</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
              Password updated successfully. Please sign in again with your new password.
            </div>
            <Link
              href="/auth/signin"
              className="block w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors text-center"
            >
              Go to Sign In
            </Link>
          </div>
        ) : !hasRecoverySession ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error || "This reset link is invalid or has expired. Please request a new one."}
            </div>
            <Link
              href="/auth/signin"
              className="block w-full bg-gray-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-gray-700 transition-colors text-center"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200"
            >
              {loading ? "Updating password..." : "Update password"}
            </button>

            <Link
              href="/auth/signin"
              className="block text-center text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel and return to Sign In
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
