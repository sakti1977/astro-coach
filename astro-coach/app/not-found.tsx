import Link from "next/link";

export const metadata = { title: "Page not found — Jyotish Coach" };

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">404</p>
        <h1 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">This page isn&apos;t in the chart</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">The link may be old or mistyped.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
          Go to home
        </Link>
      </div>
    </main>
  );
}
