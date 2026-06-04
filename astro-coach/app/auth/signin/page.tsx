"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Country code list ──────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { flag: "🇮🇳", code: "+91",  label: "IN" },
  { flag: "🇺🇸", code: "+1",   label: "US" },
  { flag: "🇬🇧", code: "+44",  label: "GB" },
  { flag: "🇦🇺", code: "+61",  label: "AU" },
  { flag: "🇦🇪", code: "+971", label: "AE" },
  { flag: "🇸🇬", code: "+65",  label: "SG" },
  { flag: "🇨🇦", code: "+1",   label: "CA" },
  { flag: "🇩🇪", code: "+49",  label: "DE" },
  { flag: "🇫🇷", code: "+33",  label: "FR" },
  { flag: "🇯🇵", code: "+81",  label: "JP" },
  { flag: "🇧🇩", code: "+880", label: "BD" },
  { flag: "🇵🇰", code: "+92",  label: "PK" },
  { flag: "🇱🇰", code: "+94",  label: "LK" },
  { flag: "🇳🇵", code: "+977", label: "NP" },
  { flag: "🇿🇦", code: "+27",  label: "ZA" },
  { flag: "🇧🇷", code: "+55",  label: "BR" },
  { flag: "🇳🇬", code: "+234", label: "NG" },
  { flag: "🇰🇪", code: "+254", label: "KE" },
  { flag: "🇸🇦", code: "+966", label: "SA" },
  { flag: "🇮🇩", code: "+62",  label: "ID" },
  { flag: "🇲🇾", code: "+60",  label: "MY" },
  { flag: "🇵🇭", code: "+63",  label: "PH" },
  { flag: "🇹🇭", code: "+66",  label: "TH" },
];

type AuthTab  = "email" | "phone";
type EmailMode = "signin" | "signup";
type PhoneStep = "enter-phone" | "enter-otp";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl mb-4">✦</div>
        <p className="text-gray-500">Loading…</p>
      </div>
    </div>
  );
}

// ── Email auth form ────────────────────────────────────────────────────────
function EmailAuthForm({
  callbackUrl,
}: {
  callbackUrl: string;
}) {
  const router = useRouter();
  const [mode, setMode]                   = useState<EmailMode>("signin");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [info, setInfo]                   = useState(""); // success/info messages
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent]         = useState(false);

  function getResetRedirectUrl() {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/reset-password`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        mode,
      });

      if (result?.error) {
        // Distinguish informational messages from real errors
        const msg = result.error;
        if (msg.toLowerCase().includes("check your email") ||
            msg.toLowerCase().includes("confirmation link")) {
          setInfo(msg);
        } else {
          setError(msg);
        }
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!supabase) {
      setError("Password reset is not configured. Please contact support.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: getResetRedirectUrl() }
      );

      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Show success screen after email signup with confirmation
  if (info) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <div className="text-3xl mb-2">📬</div>
          <p className="text-sm font-medium text-green-800 mb-1">Check your inbox!</p>
          <p className="text-sm text-green-700">{info}</p>
        </div>
        <button
          type="button"
          onClick={() => { setInfo(""); setMode("signin"); }}
          className="w-full border border-gray-200 text-gray-700 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <form onSubmit={handleForgotPassword} className="space-y-4">
        <div className="text-center">
          <h2 className="text-base font-semibold text-gray-900">Reset your password</h2>
          <p className="text-xs text-gray-500 mt-1">
            Enter your account email and we&apos;ll send a secure reset link.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {resetSent && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
            If an account exists for this email, a password reset link has been sent.
          </div>
        )}

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
          {loading ? "Sending reset link…" : "Send reset link"}
        </button>

        <button
          type="button"
          onClick={() => { setShowForgotPassword(false); setResetSent(false); setError(""); }}
          className="w-full border border-gray-200 text-gray-700 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          Back to Sign In
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode toggle */}
      <div className="flex rounded-xl bg-gray-100 p-0.5 gap-0.5">
        {(["signin", "signup"] as EmailMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError("");
              setInfo("");
              setConfirmPassword("");
              setShowForgotPassword(false);
              setResetSent(false);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === m
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m === "signin" ? "Sign In" : "Sign Up"}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
          {mode === "signup" && (
            <span className="text-gray-400 font-normal ml-1">(min. 6 characters)</span>
          )}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {mode === "signin" && (
          <div className="text-right mt-1.5">
            <button
              type="button"
              onClick={() => { setShowForgotPassword(true); setError(""); setInfo(""); }}
              className="text-xs text-indigo-700 hover:text-indigo-900 underline"
            >
              Forgot password?
            </button>
          </div>
        )}
      </div>

      {mode === "signup" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
            className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              confirmPassword && confirmPassword !== password
                ? "border-red-300 bg-red-50"
                : "border-gray-200"
            }`}
          />
          {confirmPassword && confirmPassword !== password && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (mode === "signup" && !!confirmPassword && confirmPassword !== password)}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200"
      >
        {loading
          ? mode === "signin" ? "Signing in…" : "Creating account…"
          : mode === "signin" ? "Sign In" : "Create Account"}
      </button>

      {mode === "signin" && (
        <p className="text-center text-xs text-gray-500">
          Don&apos;t have an account?{" "}
          <button type="button" onClick={() => { setMode("signup"); setError(""); }}
            className="text-gray-900 font-medium hover:underline">
            Sign up free
          </button>
        </p>
      )}
    </form>
  );
}

// ── Phone OTP form ─────────────────────────────────────────────────────────
function PhoneAuthForm({ callbackUrl }: { callbackUrl: string }) {
  const router                            = useRouter();
  const [step, setStep]                   = useState<PhoneStep>("enter-phone");
  const [countryCode, setCountryCode]     = useState("+91");
  const [phoneNumber, setPhoneNumber]     = useState("");
  const [otp, setOtp]                     = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;

  // Cooldown timer
  function startCooldown(seconds = 60) {
    setResendCooldown(seconds);
    const interval = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function sendOtp() {
    if (!supabase) {
      setError("Supabase is not configured. Please contact support.");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Please enter your phone number");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });
      if (otpError) throw otpError;
      setStep("enter-otp");
      startCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Verify OTP with Supabase client-side
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: "sms",
      });

      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("No session returned after OTP verification");

      // Hand the Supabase access token to NextAuth so it creates a JWT session
      const result = await signIn("credentials", {
        redirect: false,
        mode: "phone-otp",
        phone: fullPhone,
        accessToken: data.session.access_token,
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: phone input ──────────────────────────────────────────────────
  if (step === "enter-phone") {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              aria-label="Country code"
              title="Country code"
              className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={`${c.code}-${c.label}`} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="98765 43210"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && sendOtp()}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            A 6-digit OTP will be sent via SMS
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={sendOtp}
          disabled={loading || !phoneNumber.trim()}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200"
        >
          {loading ? "Sending OTP…" : "Send OTP"}
        </button>
      </div>
    );
  }

  // ── Step 2: OTP input ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="text-center p-4 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-600">
          Code sent to{" "}
          <span className="font-semibold text-gray-900">{fullPhone}</span>
        </p>
        <button
          type="button"
          onClick={() => { setStep("enter-phone"); setOtp(""); setError(""); }}
          className="text-xs text-gray-400 hover:text-gray-600 underline mt-1"
        >
          Change number
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Enter 6-digit OTP
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="• • • • • •"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verifyOtp()}
          autoFocus
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={verifyOtp}
        disabled={loading || otp.length !== 6}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200"
      >
        {loading ? "Verifying…" : "Verify & Sign In"}
      </button>

      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-xs text-gray-400">Resend OTP in {resendCooldown}s</p>
        ) : (
          <button
            type="button"
            onClick={() => { sendOtp(); setOtp(""); setError(""); }}
            disabled={loading}
            className="text-xs text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
          >
            Resend OTP
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main sign-in page ──────────────────────────────────────────────────────
function SignInForm() {
  const searchParams  = useSearchParams();
  const callbackUrl   = searchParams.get("callbackUrl") || "/";
  const [tab, setTab] = useState<AuthTab>("email");

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <span className="text-white text-lg">✦</span>
            </div>
            <span className="font-bold text-gray-900 text-xl tracking-tight">Astro Coach</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {tab === "email" ? "Welcome back" : "Sign in with phone"}
          </h1>
          <p className="text-sm text-gray-500">
            {tab === "email"
              ? "Enter your email and password to continue"
              : "We'll send a one-time code via SMS"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-2xl bg-gray-100 p-1 mb-6 gap-1">
          {(["email", "phone"] as AuthTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 rounded-xl transition-all ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "email" ? (
                <><span>✉️</span> Email</>
              ) : (
                <><span>📱</span> Phone OTP</>
              )}
            </button>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl p-8 shadow-xl shadow-gray-100/80 border border-gray-100">
          {tab === "email" ? (
            <EmailAuthForm callbackUrl={callbackUrl} />
          ) : (
            <PhoneAuthForm callbackUrl={callbackUrl} />
          )}
        </div>

        {/* Privacy note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          🔒 Your data is encrypted and stored securely
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SignInForm />
    </Suspense>
  );
}
