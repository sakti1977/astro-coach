/**
 * Server-only client for Sarvam AI's Indian-language APIs (translate,
 * speech-to-text, text-to-speech). Never import this from a "use client" file
 * — SARVAM_API_KEY must stay server-side, same pattern as lib/claude.ts.
 *
 * Sarvam is used as a translation/voice layer around the existing English-
 * language Claude coaching pipeline, not as a replacement for it: Claude keeps
 * reasoning and writing in English (where all the Jyotish prompt engineering —
 * chain analysis, dosha/remedy terminology — lives), and Sarvam's dedicated
 * Indic models translate the finished text and handle voice, so mantras and
 * Sanskrit terms stay consistent regardless of the user's chosen language.
 */

const SARVAM_BASE_URL = "https://api.sarvam.ai";
const TRANSLATE_MODEL = "sarvam-translate:v1";
const TRANSLATE_MAX_CHARS = 2000; // sarvam-translate:v1 limit
const TTS_MODEL = "bulbul:v3";
const TTS_MAX_CHARS = 2500; // bulbul:v3 limit
const STT_MODEL = "saaras:v3";

function apiKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY is not configured");
  return key;
}

/** Split text into chunks at paragraph/sentence boundaries, each ≤ maxChars. */
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (para.length <= maxChars) {
      current = para;
    } else {
      // Single paragraph itself exceeds the limit — split on sentence boundaries.
      const sentences = para.split(/(?<=[.!?।])\s+/);
      let piece = "";
      for (const sentence of sentences) {
        const candidatePiece = piece ? `${piece} ${sentence}` : sentence;
        if (candidatePiece.length <= maxChars) {
          piece = candidatePiece;
        } else {
          if (piece) chunks.push(piece);
          piece = sentence.slice(0, maxChars); // last-resort hard truncation
        }
      }
      current = piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export interface TranslateResult {
  translatedText: string;
}

/** Translate text via Sarvam Translate. sourceLanguageCode may be "auto". */
export async function translateText(
  input: string,
  sourceLanguageCode: string,
  targetLanguageCode: string
): Promise<TranslateResult> {
  if (!input.trim()) return { translatedText: input };
  if (sourceLanguageCode === targetLanguageCode) return { translatedText: input };

  const chunks = chunkText(input, TRANSLATE_MAX_CHARS);
  const translated: string[] = [];

  for (const chunk of chunks) {
    const res = await fetch(`${SARVAM_BASE_URL}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey(),
      },
      body: JSON.stringify({
        input: chunk,
        source_language_code: sourceLanguageCode,
        target_language_code: targetLanguageCode,
        model: TRANSLATE_MODEL,
        mode: "formal",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Sarvam translate error (${res.status}): ${text}`);
    }
    const data = await res.json();
    translated.push(data.translated_text as string);
  }

  return { translatedText: translated.join("\n\n") };
}

export interface SpeechToTextResult {
  transcript: string;
  languageCode: string | null;
}

/**
 * Transcribe audio via Sarvam Speech-to-Text.
 * languageCode: pass a BCP-47 code (e.g. "hi-IN") or "unknown" for auto-detect.
 */
export async function speechToText(
  audio: Blob,
  filename: string,
  languageCode: string = "unknown"
): Promise<SpeechToTextResult> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", STT_MODEL);
  form.append("mode", "transcribe");
  form.append("language_code", languageCode);

  const res = await fetch(`${SARVAM_BASE_URL}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": apiKey() },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Sarvam speech-to-text error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return {
    transcript: data.transcript as string,
    languageCode: (data.language_code as string) ?? null,
  };
}

export interface TextToSpeechResult {
  /** Base64-encoded audio clips, in playback order (chunked for long text). */
  audioClips: string[];
  audioCodec: string;
}

export async function textToSpeech(
  text: string,
  targetLanguageCode: string,
  speaker?: string
): Promise<TextToSpeechResult> {
  const chunks = chunkText(text, TTS_MAX_CHARS);
  const audioClips: string[] = [];

  for (const chunk of chunks) {
    const res = await fetch(`${SARVAM_BASE_URL}/text-to-speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey(),
      },
      body: JSON.stringify({
        text: chunk,
        target_language_code: targetLanguageCode,
        model: TTS_MODEL,
        ...(speaker ? { speaker } : {}),
        output_audio_codec: "mp3",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Sarvam text-to-speech error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    audioClips.push(...((data.audios as string[]) ?? []));
  }

  return { audioClips, audioCodec: "mp3" };
}
