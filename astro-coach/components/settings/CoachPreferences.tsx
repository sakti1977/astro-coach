"use client";

import { SARVAM_LANGUAGES } from "@/lib/languages";
import { getProfile, saveProfile, type CoachTonePreference } from "@/lib/profile";

export interface CoachPreferenceValues {
  includeReligiousSolutions: boolean;
  tonePreference: CoachTonePreference;
  preferredLanguage: string;
}

/** Read the current coaching preferences from the saved profile. */
export function readCoachPreferences(): CoachPreferenceValues {
  const { coaching } = getProfile();
  return {
    includeReligiousSolutions: coaching.includeReligiousSolutions ?? false,
    tonePreference: coaching.tonePreference ?? "jyotish",
    preferredLanguage: coaching.preferredLanguage,
  };
}

/** Persist a change to the coaching preferences (synced with the rest of the profile). */
export function saveCoachPreferences(change: Partial<CoachPreferenceValues>): void {
  const current = getProfile();
  saveProfile({ ...current, coaching: { ...current.coaching, ...change } });
}

function Segmented<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              value === o.value ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The coach's settings: remedy mode, voice, and language. Used both in the
 * chat's settings panel and on the Profile page, so they stay in one place.
 */
export default function CoachPreferences({
  value,
  onChange,
}: {
  value: CoachPreferenceValues;
  onChange: (change: Partial<CoachPreferenceValues>) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Segmented
        label="Remedies"
        hint="Behavioral practice is always included."
        value={value.includeReligiousSolutions ? "vedic" : "behavioral"}
        options={[
          { value: "behavioral", label: "Behavioral only" },
          { value: "vedic", label: "+ Vedic remedies" },
        ]}
        onChange={(v) => onChange({ includeReligiousSolutions: v === "vedic" })}
      />
      <Segmented
        label="Voice"
        hint="Same chart and analysis either way."
        value={value.tonePreference}
        options={[
          { value: "jyotish", label: "Traditional" },
          { value: "skeptic", label: "Plain language" },
        ]}
        onChange={(v) => onChange({ tonePreference: v })}
      />
      <div>
        <label htmlFor="coach-language" className="text-sm font-medium text-gray-900">Language</label>
        <p className="text-xs text-gray-500 mb-2">Your messages and replies are translated.</p>
        <select
          id="coach-language"
          value={value.preferredLanguage}
          onChange={(e) => onChange({ preferredLanguage: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {SARVAM_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
