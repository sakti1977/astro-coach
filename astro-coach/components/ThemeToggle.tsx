"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, readThemePreference, saveThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/** System / Light / Dark. `compact` shows icons only (sidebar). */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    // Read after mount: the server render can't know the stored choice.
    queueMicrotask(() => setPref(readThemePreference()));
    const onChange = (e: Event) => setPref((e as CustomEvent<ThemePreference>).detail);
    window.addEventListener("astro-coach-theme", onChange);
    // Follow the OS live while on "system".
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => { if (readThemePreference() === "system") applyTheme("system"); };
    mq.addEventListener("change", onSystem);
    return () => {
      window.removeEventListener("astro-coach-theme", onChange);
      mq.removeEventListener("change", onSystem);
    };
  }, []);

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => saveThemePreference(value)}
          className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors ${compact ? "p-1.5" : "px-3 py-1.5 text-xs"} ${
            pref === value ? "bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}
