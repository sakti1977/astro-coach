/** Languages offered in the coach's language picker — a curated subset of the
 * 23 official Indian languages Sarvam AI's Translate/STT/TTS APIs support. */
export interface LanguageOption {
  code: string; // Sarvam BCP-47 code
  label: string;
}

export const SARVAM_LANGUAGES: LanguageOption[] = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिंदी (Hindi)" },
  { code: "bn-IN", label: "বাংলা (Bengali)" },
  { code: "ta-IN", label: "தமிழ் (Tamil)" },
  { code: "te-IN", label: "తెలుగు (Telugu)" },
  { code: "mr-IN", label: "मराठी (Marathi)" },
  { code: "gu-IN", label: "ગુજરાતી (Gujarati)" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ml-IN", label: "മലയാളം (Malayalam)" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "od-IN", label: "ଓଡ଼ିଆ (Odia)" },
  { code: "ur-IN", label: "اردو (Urdu)" },
];

export const DEFAULT_LANGUAGE_CODE = "en-IN";
