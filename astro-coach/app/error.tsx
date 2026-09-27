"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[page-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your saved chart and history are safe. Try again, or go back to the home page.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Try again
          </button>
          <Link href="/" className="rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm text-gray-700 dark:text-gray-300">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
