import type { ReactNode } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { LEGAL } from "@/lib/legal";

/** Shared reading layout for the Privacy Policy and Terms pages. */
export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <AppShell>
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Effective {LEGAL.effectiveDate}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">{intro}</p>
        </div>
      </div>
      <article className="legal max-w-2xl mx-auto px-4 sm:px-6 py-10 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {children}
        <p className="mt-10 text-xs text-gray-500 dark:text-gray-400">
          See also: <Link href="/privacy" className="underline">Privacy Policy</Link> ·{" "}
          <Link href="/terms" className="underline">Terms of Use</Link> ·{" "}
          <Link href="/trust" className="underline">How we work</Link>
        </p>
      </article>
    </AppShell>
  );
}
