/**
 * Light / dark / follow-the-system theme. The choice is a per-device
 * convenience kept in localStorage; "system" (the default) follows the OS.
 * The `dark` class on <html> drives Tailwind's `dark:` variant (see
 * globals.css) and is set by THEME_BOOT_SCRIPT before first paint, so there
 * is no light flash on a dark device.
 */

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "astro-coach-theme";

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): "light" | "dark" {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

export function applyTheme(pref: ThemePreference): void {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = resolveTheme(pref, systemDark) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function saveThemePreference(pref: ThemePreference): void {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  applyTheme(pref);
  window.dispatchEvent(new CustomEvent("astro-coach-theme", { detail: pref }));
}

/** Inlined in <head>; must stay dependency-free and tiny. */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
