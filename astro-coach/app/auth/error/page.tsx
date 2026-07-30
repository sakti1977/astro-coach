"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification token has expired or has already been used.",
    Default: "Unable to sign in. Please try again.",
  };

  const message = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            <span className="font-semibold text-gray-900 text-xl tracking-tight">Astro Coach</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
        </div>

        <div className="border border-red-200 rounded-2xl p-8 bg-red-50">
          <div className="text-center mb-6">
            <AlertTriangle className="w-9 h-9 mx-auto text-red-500" />
          </div>
          <p className="text-sm text-red-700 text-center mb-6">{message}</p>
          <Link
            href="/auth/signin"
            className="block w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors text-center"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-8 h-8 mb-4 mx-auto text-indigo-400" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
